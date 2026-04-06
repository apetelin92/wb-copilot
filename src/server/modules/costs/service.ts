import { z } from "zod";

import { recordAuditLog } from "@/server/lib/audit";
import { AppError } from "@/server/lib/errors";
import { prisma } from "@/server/lib/prisma";
import { hasCompleteManualCosts } from "@/server/modules/costs/completeness";
import { rebuildDailyProfitability } from "@/server/modules/profitability/service";
import { resolveOrganizationContext } from "@/server/modules/workspace/context";

export const createCostProfileSchema = z.object({
  effectiveFrom: z.coerce.date(),
  cogsRub: z.number().nonnegative(),
  packagingRub: z.number().nonnegative().default(0),
  handlingRub: z.number().nonnegative().default(0),
  otherUnitCostRub: z.number().nonnegative().default(0),
  notes: z.string().trim().max(500).optional(),
  isComplete: z.boolean().default(true)
});

export async function createCostProfile(skuId: string, input: z.infer<typeof createCostProfileSchema>, options?: { organizationId?: string }) {
  const organization = await resolveOrganizationContext(options);
  const payload = createCostProfileSchema.parse(input);
  const normalizedPayload = {
    ...payload,
    isComplete: hasCompleteManualCosts(payload)
  };
  const sku = await prisma.sKU.findFirst({
    where: { id: skuId, organizationId: organization.id }
  });

  if (!sku) {
    throw new AppError(404, "sku_not_found", "SKU not found.");
  }

  const costProfile = await prisma.costProfile.upsert({
    where: {
      skuId_effectiveFrom: {
        skuId,
        effectiveFrom: payload.effectiveFrom
      }
    },
    update: normalizedPayload,
    create: {
      organizationId: organization.id,
      skuId,
      ...normalizedPayload
    }
  });

  await recordAuditLog({
    organizationId: organization.id,
    entityType: "CostProfile",
    entityId: costProfile.id,
    action: "upserted",
    payload: {
      skuId,
      effectiveFrom: payload.effectiveFrom.toISOString(),
      isComplete: normalizedPayload.isComplete
    }
  });

  return costProfile;
}

export async function upsertCostProfileAndRebuild(skuId: string, input: z.infer<typeof createCostProfileSchema>, options?: { organizationId?: string }) {
  const organization = await resolveOrganizationContext(options);
  const payload = createCostProfileSchema.parse(input);
  const costProfile = await createCostProfile(skuId, payload, options);
  const latestRecord = await prisma.normalizedFinancialRecord.findFirst({
    where: {
      organizationId: organization.id,
      skuId,
      recordDate: {
        gte: payload.effectiveFrom
      }
    },
    orderBy: { recordDate: "desc" }
  });

  if (latestRecord) {
    await rebuildDailyProfitability({
      organizationId: organization.id,
      fromDate: payload.effectiveFrom,
      toDate: latestRecord.recordDate
    });
  }

  return costProfile;
}

function toCsvCell(value: unknown) {
  const stringValue = value == null ? "" : String(value);
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function parseCsv(content: string) {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const symbol = content[index];
    const nextSymbol = content[index + 1];

    if (symbol === '"') {
      if (inQuotes && nextSymbol === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (symbol === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((symbol === "\n" || symbol === "\r") && !inQuotes) {
      if (symbol === "\r" && nextSymbol === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += symbol;
  }

  currentRow.push(currentCell);
  if (currentRow.some((cell) => cell.trim().length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

function parseBoolean(value: string | undefined, fallback = true) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return ["true", "1", "yes", "да", "y"].includes(normalized);
}

function parseNumberCell(value: string | undefined) {
  const normalized = (value ?? "").trim().replace(",", ".");
  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError(400, "cost_import_invalid_number", `Некорректное числовое значение: ${value ?? ""}`);
  }

  return parsed;
}

async function buildCostProfilesCsv(options?: { organizationId?: string; includeCurrentValues?: boolean }) {
  const organization = await resolveOrganizationContext(options);
  const [skus, profiles] = await Promise.all([
    prisma.sKU.findMany({
      where: { organizationId: organization.id },
      orderBy: { title: "asc" }
    }),
    prisma.costProfile.findMany({
      where: { organizationId: organization.id },
      orderBy: [{ skuId: "asc" }, { effectiveFrom: "desc" }]
    })
  ]);

  const latestProfileBySkuId = new Map<string, (typeof profiles)[number]>();
  for (const profile of profiles) {
    if (!latestProfileBySkuId.has(profile.skuId)) {
      latestProfileBySkuId.set(profile.skuId, profile);
    }
  }

  const header = [
    "wb_nm_id",
    "vendor_code",
    "sku_title",
    "effective_from",
    "cogs_rub",
    "packaging_rub",
    "handling_rub",
    "other_unit_cost_rub",
    "is_complete",
    "notes"
  ];

  const rows = skus.map((sku) => {
    const profile = options?.includeCurrentValues === false ? null : latestProfileBySkuId.get(sku.id);

    return [
      sku.wbNmId,
      sku.vendorCode ?? "",
      sku.title,
      profile?.effectiveFrom.toISOString().slice(0, 10) ?? "",
      profile?.cogsRub ?? "",
      profile?.packagingRub ?? "",
      profile?.handlingRub ?? "",
      profile?.otherUnitCostRub ?? "",
      profile ? (profile.isComplete ? "true" : "false") : "",
      profile?.notes ?? ""
    ];
  });

  return [header, ...rows].map((row) => row.map((cell) => toCsvCell(cell)).join(",")).join("\n");
}

export async function listLatestCostProfilesForExport(options?: { organizationId?: string }) {
  return buildCostProfilesCsv({ ...options, includeCurrentValues: true });
}

export async function listCostProfilesTemplateForExport(options?: { organizationId?: string }) {
  return buildCostProfilesCsv({ ...options, includeCurrentValues: false });
}

export async function importCostProfilesFromCsv(content: string, options?: { organizationId?: string }) {
  const organization = await resolveOrganizationContext(options);
  const rows = parseCsv(content.trim());

  if (rows.length < 2) {
    throw new AppError(400, "cost_import_empty", "Файл пустой или не содержит строк для импорта.");
  }

  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const getColumnIndex = (name: string) => header.indexOf(name);
  const wbNmIdIndex = getColumnIndex("wb_nm_id");

  if (wbNmIdIndex === -1) {
    throw new AppError(400, "cost_import_missing_column", "В файле отсутствует обязательная колонка wb_nm_id.");
  }

  const [skus] = await Promise.all([
    prisma.sKU.findMany({
      where: { organizationId: organization.id }
    })
  ]);

  const skuByNmId = new Map(skus.map((sku) => [sku.wbNmId, sku]));
  const errors: string[] = [];
  let importedCount = 0;

  for (const [index, row] of rows.slice(1).entries()) {
    const lineNumber = index + 2;
    const wbNmId = (row[wbNmIdIndex] ?? "").trim();
    const effectiveFromCell = (row[getColumnIndex("effective_from")] ?? "").trim();
    const cogsCell = (row[getColumnIndex("cogs_rub")] ?? "").trim();
    const packagingCell = (row[getColumnIndex("packaging_rub")] ?? "").trim();
    const handlingCell = (row[getColumnIndex("handling_rub")] ?? "").trim();
    const otherCostCell = (row[getColumnIndex("other_unit_cost_rub")] ?? "").trim();
    const notesCell = (row[getColumnIndex("notes")] ?? "").trim();

    if (!wbNmId) {
      continue;
    }

    if (!effectiveFromCell && !cogsCell && !packagingCell && !handlingCell && !otherCostCell && !notesCell) {
      continue;
    }

    const sku = skuByNmId.get(wbNmId);
    if (!sku) {
      errors.push(`Строка ${lineNumber}: SKU с wb_nm_id=${wbNmId} не найден.`);
      continue;
    }

    try {
      await upsertCostProfileAndRebuild(
        sku.id,
        {
          effectiveFrom: new Date(effectiveFromCell || new Date().toISOString().slice(0, 10)),
          cogsRub: parseNumberCell(cogsCell),
          packagingRub: parseNumberCell(packagingCell),
          handlingRub: parseNumberCell(handlingCell),
          otherUnitCostRub: parseNumberCell(otherCostCell),
          isComplete: parseBoolean(row[getColumnIndex("is_complete")], true),
          notes: notesCell || undefined
        },
        { organizationId: organization.id }
      );
      importedCount += 1;
    } catch (error) {
      errors.push(`Строка ${lineNumber}: ${error instanceof Error ? error.message : "не удалось импортировать"}`);
    }
  }

  if (errors.length > 0) {
    throw new AppError(400, "cost_import_failed", errors.slice(0, 5).join(" "));
  }

  return {
    importedCount
  };
}
