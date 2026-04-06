import { RawSourceType, SyncRunStatus, SyncTrigger, WbConnectionStatus, SkuStatus, NormalizedRecordType } from "@prisma/client";
import { z } from "zod";

import { recordAuditLog } from "@/server/lib/audit";
import { addUtcDays, startOfUtcDay } from "@/server/lib/date";
import { AppError } from "@/server/lib/errors";
import { toJsonValue } from "@/server/lib/json";
import { prisma } from "@/server/lib/prisma";
import { recordOperationalError } from "@/server/lib/ops-error";
import { ensureSkuInsight, generateDailyBrief, upsertCashGapInsight } from "@/server/modules/insights/service";
import { rebuildDailyProfitability } from "@/server/modules/profitability/service";
import { projectCashGap } from "@/server/modules/risk/service";
import { createWbAdapter } from "@/server/modules/wb/adapter";
import { getSyncCredentials, markConnectionSyncState } from "@/server/modules/wb/service";
import type { WbFeeRecord, WbProduct, WbSaleRecord, WbSyncPayload } from "@/server/modules/wb/types";
import { resolveOrganizationContext } from "@/server/modules/workspace/context";

export const runSyncSchema = z.object({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  trigger: z.nativeEnum(SyncTrigger).default(SyncTrigger.MANUAL)
});

const ACTIVE_SYNC_STATUSES = [
  SyncRunStatus.SCHEDULED,
  SyncRunStatus.IMPORTING,
  SyncRunStatus.NORMALIZING,
  SyncRunStatus.CALCULATING,
  SyncRunStatus.GENERATING_INSIGHTS,
  SyncRunStatus.PROJECTING_CASH
];

async function updateSyncRun(syncRunId: string, status: SyncRunStatus, input?: { errorMessage?: string | null; stats?: Record<string, unknown>; finishedAt?: Date }) {
  await prisma.syncRun.update({
    where: { id: syncRunId },
    data: {
      status,
      errorMessage: input?.errorMessage,
      stats: toJsonValue(input?.stats),
      finishedAt: input?.finishedAt
    }
  });
}

async function createRawBatch(syncRunId: string, organizationId: string, sourceType: RawSourceType, sourceDate: Date, records: unknown[]) {
  const batch = await prisma.rawIngestionBatch.create({
    data: {
      organizationId,
      syncRunId,
      sourceType,
      sourceDate,
      recordCount: records.length
    }
  });

  if (records.length > 0) {
    await prisma.rawWBRecord.createMany({
      data: records.map((payload, index) => ({
        batchId: batch.id,
        recordType: sourceType,
        externalId: `${String(sourceType).toLowerCase()}-${index}`,
        occurredAt: sourceDate,
        payload: toJsonValue(payload) ?? {}
      }))
    });
  }
}

async function upsertProducts(organizationId: string, products: WbProduct[], sales: WbSaleRecord[], fees: WbFeeRecord[]) {
  const seenNmIds = new Set(products.map((item) => item.nmId));
  [...sales, ...fees].forEach((record) => {
    seenNmIds.add(record.nmId);
  });

  const existingSkus = await prisma.sKU.findMany({
    where: {
      organizationId,
      wbNmId: { in: [...seenNmIds] }
    }
  });
  const existingByNmId = new Map(existingSkus.map((item) => [item.wbNmId, item]));

  for (const product of products) {
    const existing = existingByNmId.get(product.nmId);
    if (existing) {
      await prisma.sKU.update({
        where: { id: existing.id },
        data: {
          vendorCode: product.vendorCode,
          title: product.title,
          brand: product.brand,
          subject: product.subject,
          status: SkuStatus.ACTIVE
        }
      });
    } else {
      const created = await prisma.sKU.create({
        data: {
          organizationId,
          wbNmId: product.nmId,
          vendorCode: product.vendorCode,
          title: product.title,
          brand: product.brand,
          subject: product.subject,
          status: SkuStatus.ACTIVE
        }
      });
      existingByNmId.set(product.nmId, created);
    }
  }

  for (const nmId of seenNmIds) {
    if (!existingByNmId.has(nmId)) {
      const placeholder = await prisma.sKU.create({
        data: {
          organizationId,
          wbNmId: nmId,
          title: `WB SKU ${nmId}`,
          status: SkuStatus.PLACEHOLDER
        }
      });
      existingByNmId.set(nmId, placeholder);
    }
  }

  return existingByNmId;
}

async function replaceNormalizedFinancialData(input: {
  organizationId: string;
  syncRunId: string;
  fromDate: Date;
  toDate: Date;
  skuByNmId: Map<string, { id: string }>;
  payload: WbSyncPayload;
}) {
  await prisma.$transaction(async (tx) => {
    await tx.normalizedFinancialRecord.deleteMany({
      where: {
        organizationId: input.organizationId,
        recordDate: {
          gte: input.fromDate,
          lte: input.toDate
        }
      }
    });

    await tx.payoutForecast.deleteMany({
      where: {
        organizationId: input.organizationId,
        forecastDate: {
          gte: input.fromDate,
          lte: addUtcDays(input.toDate, 7)
        }
      }
    });

    if (input.payload.sales.length > 0) {
      await tx.normalizedFinancialRecord.createMany({
        data: input.payload.sales.map((sale) => ({
          organizationId: input.organizationId,
          syncRunId: input.syncRunId,
          skuId: input.skuByNmId.get(sale.nmId)?.id ?? "",
          recordType: NormalizedRecordType.SALE,
          recordDate: sale.recordDate,
          sourceExternalId: sale.externalId,
          soldUnits: sale.soldUnits,
          returnedUnits: sale.returnedUnits,
          grossRevenueRub: sale.grossRevenueRub,
          discountRub: sale.discountRub,
          refundRub: sale.refundRub,
          payload: toJsonValue(sale)
        }))
      });
    }

    if (input.payload.fees.length > 0) {
      await tx.normalizedFinancialRecord.createMany({
        data: input.payload.fees.map((fee) => ({
          organizationId: input.organizationId,
          syncRunId: input.syncRunId,
          skuId: input.skuByNmId.get(fee.nmId)?.id ?? "",
          recordType: NormalizedRecordType.FEE,
          recordDate: fee.recordDate,
          sourceExternalId: fee.externalId,
          commissionRub: fee.commissionRub,
          logisticsRub: fee.logisticsRub,
          storageRub: fee.storageRub,
          penaltyRub: fee.penaltyRub,
          returnCostRub: fee.returnCostRub,
          payload: toJsonValue(fee)
        }))
      });
    }

    if (input.payload.payouts.length > 0) {
      await tx.payoutForecast.createMany({
        data: input.payload.payouts.map((payout) => ({
          organizationId: input.organizationId,
          syncRunId: input.syncRunId,
          forecastDate: payout.payoutDate,
          sourceExternalId: payout.externalId,
          amountRub: payout.amountRub
        }))
      });
    }
  }, {
    maxWait: 60_000,
    timeout: 60_000
  });
}

async function generateSkuInsightsForFeed(input: { organizationId: string; syncRunId: string; asOfDate: Date }) {
  const metrics = await prisma.dailySkuMetric.findMany({
    where: {
      organizationId: input.organizationId,
      metricDate: input.asOfDate
    },
    orderBy: [{ contributionProfitRub: "asc" }],
    take: 4
  });
  const topMetrics = await prisma.dailySkuMetric.findMany({
    where: {
      organizationId: input.organizationId,
      metricDate: input.asOfDate
    },
    orderBy: [{ contributionProfitRub: "desc" }],
    take: 3
  });

  const skuIds = [...new Set([...metrics, ...topMetrics].map((item) => item.skuId))];

  await Promise.all(
    skuIds.map((skuId) =>
      ensureSkuInsight({
        organizationId: input.organizationId,
        skuId,
        asOfDate: input.asOfDate,
        syncRunId: input.syncRunId
      })
    )
  );
}

export async function runWbSync(input: z.infer<typeof runSyncSchema>, options?: { organizationId?: string }) {
  const payload = runSyncSchema.parse(input);
  const { organizationId, connectionId, credentials, workspaceKind } = await getSyncCredentials(options);
  const today = startOfUtcDay(new Date());
  const fromDate = startOfUtcDay(payload.fromDate ?? addUtcDays(today, -6));
  const toDate = startOfUtcDay(payload.toDate ?? today);

  if (fromDate.getTime() > toDate.getTime()) {
    throw new AppError(400, "invalid_sync_window", "fromDate must be before or equal to toDate.");
  }

  const activeSyncRun = await prisma.syncRun.findFirst({
    where: {
      organizationId,
      status: {
        in: ACTIVE_SYNC_STATUSES
      }
    },
    orderBy: { startedAt: "desc" }
  });

  if (activeSyncRun) {
    throw new AppError(409, "sync_already_running", "Синхронизация уже выполняется. Дождитесь завершения текущего запуска.");
  }

  const syncRun = await prisma.syncRun.create({
    data: {
      organizationId,
      connectionId,
      trigger: payload.trigger,
      status: SyncRunStatus.IMPORTING,
      fromDate,
      toDate
    }
  });

  await recordAuditLog({
    organizationId,
    entityType: "SyncRun",
    entityId: syncRun.id,
    action: "started",
    payload: { fromDate: fromDate.toISOString(), toDate: toDate.toISOString() }
  });

  try {
    const adapter = createWbAdapter({ workspaceKind });
    const wbPayload = await adapter.fetchDailySnapshot(credentials, { fromDate, toDate });

    await createRawBatch(syncRun.id, organizationId, RawSourceType.PRODUCTS, toDate, wbPayload.products);
    await createRawBatch(syncRun.id, organizationId, RawSourceType.SALES, toDate, wbPayload.sales);
    await createRawBatch(syncRun.id, organizationId, RawSourceType.FEES, toDate, wbPayload.fees);
    await createRawBatch(syncRun.id, organizationId, RawSourceType.PAYOUTS, toDate, wbPayload.payouts);

    await updateSyncRun(syncRun.id, SyncRunStatus.NORMALIZING);
    const skuByNmId = await upsertProducts(organizationId, wbPayload.products, wbPayload.sales, wbPayload.fees);
    await replaceNormalizedFinancialData({
      organizationId,
      syncRunId: syncRun.id,
      fromDate,
      toDate,
      skuByNmId,
      payload: wbPayload
    });

    await updateSyncRun(syncRun.id, SyncRunStatus.CALCULATING);
    const profitability = await rebuildDailyProfitability({ organizationId, fromDate, toDate });

    await updateSyncRun(syncRun.id, SyncRunStatus.PROJECTING_CASH);
    const cashProjection = await projectCashGap({ organizationId, asOfDate: toDate, windowDays: 14 });
    await upsertCashGapInsight({
      organizationId,
      syncRunId: syncRun.id,
      asOfDate: toDate,
      riskLevel: cashProjection.riskLevel,
      explanation: cashProjection.explanation
    });

    await updateSyncRun(syncRun.id, SyncRunStatus.GENERATING_INSIGHTS);
    const brief = await generateDailyBrief({
      organizationId,
      syncRunId: syncRun.id,
      asOfDate: toDate,
      riskSummary: cashProjection.explanation
    });
    await generateSkuInsightsForFeed({
      organizationId,
      syncRunId: syncRun.id,
      asOfDate: toDate
    });

    await updateSyncRun(syncRun.id, SyncRunStatus.COMPLETED, {
      finishedAt: new Date(),
      stats: {
        products: wbPayload.products.length,
        sales: wbPayload.sales.length,
        fees: wbPayload.fees.length,
        payouts: wbPayload.payouts.length,
        dailySkuMetrics: profitability.dailySkuMetricsCount,
        briefId: brief?.id ?? null
      }
    });

    await markConnectionSyncState(connectionId, {
      lastSyncAt: new Date(),
      lastError: null,
      status: WbConnectionStatus.CONNECTED
    });

    await recordAuditLog({
      organizationId,
      entityType: "SyncRun",
      entityId: syncRun.id,
      action: "completed",
      payload: {
        dailySkuMetrics: profitability.dailySkuMetricsCount,
        riskLevel: cashProjection.riskLevel
      }
    });

    return await prisma.syncRun.findUnique({
      where: { id: syncRun.id }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await updateSyncRun(syncRun.id, SyncRunStatus.FAILED, {
      errorMessage: message,
      finishedAt: new Date()
    });
    await markConnectionSyncState(connectionId, {
      lastError: message,
      status: WbConnectionStatus.ERROR
    });
    await recordAuditLog({
      organizationId,
      entityType: "SyncRun",
      entityId: syncRun.id,
      action: "failed",
      payload: { message }
    });
    await recordOperationalError({
      organizationId,
      scope: "wb_sync_failed",
      message,
      details: {
        syncRunId: syncRun.id,
        fromDate: fromDate.toISOString(),
        toDate: toDate.toISOString()
      }
    });

    throw error;
  }
}

export async function listSyncRuns(options?: { organizationId?: string }) {
  const organization = await resolveOrganizationContext(options);
  const syncRuns = await prisma.syncRun.findMany({
    where: { organizationId: organization.id },
    orderBy: { startedAt: "desc" },
    take: 20
  });

  return syncRuns;
}

export async function retrySyncRun(syncRunId: string, options?: { organizationId?: string }) {
  const organization = await resolveOrganizationContext(options);
  const syncRun = await prisma.syncRun.findFirst({
    where: {
      id: syncRunId,
      organizationId: organization.id
    }
  });

  if (!syncRun) {
    throw new AppError(404, "sync_run_not_found", "Sync run not found.");
  }

  return runWbSync(
    {
      fromDate: syncRun.fromDate,
      toDate: syncRun.toDate,
      trigger: SyncTrigger.MANUAL
    },
    options
  );
}
