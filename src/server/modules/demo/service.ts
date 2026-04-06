import { SyncTrigger } from "@prisma/client";

import { addUtcDays, startOfUtcDay } from "@/server/lib/date";
import { prisma } from "@/server/lib/prisma";
import { ensureDemoWorkspace } from "@/server/modules/bootstrap/service";
import {
  DEFAULT_DEMO_SCENARIO_KEY,
  DEMO_SCENARIOS,
  getDemoScenario,
  getDemoScenarioByCabinetId,
  type DemoScenarioKey
} from "@/server/modules/demo/scenarios";
import { upsertCostProfileAndRebuild } from "@/server/modules/costs/service";
import { upsertCashInputs } from "@/server/modules/risk/service";
import { connectWbAccount } from "@/server/modules/wb/service";
import { runWbSync } from "@/server/modules/wb/sync.service";
import { resolveOrganizationContext } from "@/server/modules/workspace/context";

type DemoSeedResult = {
  scenarioKey: DemoScenarioKey;
  connectionCreated: boolean;
  syncRunsCreated: number;
  costProfilesUpdated: number;
  commitmentsCreated: number;
};

async function resetDemoWorkspaceData(organizationId: string) {
  await prisma.aIInsight.deleteMany({ where: { organizationId } });
  await prisma.dailyBrief.deleteMany({ where: { organizationId } });
  await prisma.riskAssessment.deleteMany({ where: { organizationId } });
  await prisma.cashCommitment.deleteMany({ where: { organizationId } });
  await prisma.cashSnapshot.deleteMany({ where: { organizationId } });
  await prisma.dailyAccountMetric.deleteMany({ where: { organizationId } });
  await prisma.dailySkuMetric.deleteMany({ where: { organizationId } });
  await prisma.normalizedFinancialRecord.deleteMany({ where: { organizationId } });
  await prisma.payoutForecast.deleteMany({ where: { organizationId } });
  await prisma.costProfile.deleteMany({ where: { organizationId } });
  await prisma.syncRun.deleteMany({ where: { organizationId } });
  await prisma.sKU.deleteMany({ where: { organizationId } });
  await prisma.wBConnection.deleteMany({ where: { organizationId } });
  await prisma.auditLog.deleteMany({ where: { organizationId } });
}

function getScenarioCostAdjustments(scenarioKey: DemoScenarioKey, wbNmId: string) {
  if (scenarioKey === "growth") {
    return {
      cogsMultiplier: wbNmId === "1008" || wbNmId === "1002" ? 0.97 : 1,
      packagingMultiplier: 1,
      handlingMultiplier: 1,
      otherMultiplier: 1
    };
  }

  if (scenarioKey === "decline") {
    return {
      cogsMultiplier: wbNmId === "1004" || wbNmId === "1006" ? 1.14 : 1.08,
      packagingMultiplier: 1.08,
      handlingMultiplier: 1.1,
      otherMultiplier: 1.12
    };
  }

  return {
    cogsMultiplier: wbNmId === "1002" || wbNmId === "1008" ? 1.06 : 1.02,
    packagingMultiplier: 1.04,
    handlingMultiplier: 1.06,
    otherMultiplier: 1.08
  };
}

function getDemoCostProfilesByNmId(wbNmId: string, today: Date, scenarioKey: DemoScenarioKey) {
  const baselineFrom = addUtcDays(today, -35);
  const recentFrom = addUtcDays(today, -8);
  const adjustments = getScenarioCostAdjustments(scenarioKey, wbNmId);

  const applyAdjustments = (profile: {
    effectiveFrom: Date;
    cogsRub: number;
    packagingRub: number;
    handlingRub: number;
    otherUnitCostRub: number;
    notes: string;
    isComplete: boolean;
  }) => ({
    ...profile,
    cogsRub: Math.round(profile.cogsRub * adjustments.cogsMultiplier),
    packagingRub: Math.round(profile.packagingRub * adjustments.packagingMultiplier),
    handlingRub: Math.round(profile.handlingRub * adjustments.handlingMultiplier),
    otherUnitCostRub: Math.round(profile.otherUnitCostRub * adjustments.otherMultiplier)
  });

  switch (wbNmId) {
    case "1001":
      return [
        applyAdjustments({
          effectiveFrom: baselineFrom,
          cogsRub: 520,
          packagingRub: 35,
          handlingRub: 18,
          otherUnitCostRub: 22,
          notes: "Стабильная экономика",
          isComplete: true
        })
      ];
    case "1002":
      return [
        applyAdjustments({
          effectiveFrom: baselineFrom,
          cogsRub: 880,
          packagingRub: 42,
          handlingRub: 25,
          otherUnitCostRub: 30,
          notes: "Базовая закупочная цена",
          isComplete: true
        }),
        applyAdjustments({
          effectiveFrom: recentFrom,
          cogsRub: 960,
          packagingRub: 45,
          handlingRub: 28,
          otherUnitCostRub: 36,
          notes: "Рост закупочной цены на последней неделе",
          isComplete: true
        })
      ];
    case "1003":
      return [
        applyAdjustments({
          effectiveFrom: baselineFrom,
          cogsRub: 1290,
          packagingRub: 55,
          handlingRub: 35,
          otherUnitCostRub: 45,
          notes: "Высокий чек и стабильная себестоимость",
          isComplete: true
        })
      ];
    case "1004":
      return [
        applyAdjustments({
          effectiveFrom: baselineFrom,
          cogsRub: 1480,
          packagingRub: 60,
          handlingRub: 42,
          otherUnitCostRub: 55,
          notes: "Возвратный товар с тяжелой логистикой",
          isComplete: true
        })
      ];
    case "1005":
      return [
        applyAdjustments({
          effectiveFrom: baselineFrom,
          cogsRub: 920,
          packagingRub: 38,
          handlingRub: 18,
          otherUnitCostRub: 20,
          notes: "Складозависимый SKU",
          isComplete: true
        })
      ];
    case "1006":
      return [
        applyAdjustments({
          effectiveFrom: baselineFrom,
          cogsRub: 760,
          packagingRub: 29,
          handlingRub: 16,
          otherUnitCostRub: 18,
          notes: "Промо-товар с низкой маржой",
          isComplete: true
        }),
        applyAdjustments({
          effectiveFrom: recentFrom,
          cogsRub: 840,
          packagingRub: 32,
          handlingRub: 18,
          otherUnitCostRub: 22,
          notes: "Удорожание после промо-периода",
          isComplete: true
        })
      ];
    case "1007":
      return [
        applyAdjustments({
          effectiveFrom: baselineFrom,
          cogsRub: 640,
          packagingRub: 24,
          handlingRub: 14,
          otherUnitCostRub: 0,
          notes: "Не все дополнительные затраты подтверждены",
          isComplete: false
        })
      ];
    case "1008":
      return [
        applyAdjustments({
          effectiveFrom: baselineFrom,
          cogsRub: 1190,
          packagingRub: 44,
          handlingRub: 20,
          otherUnitCostRub: 34,
          notes: "Стабильный набор для дома с хорошей маржой",
          isComplete: true
        })
      ];
    case "1009":
      return [
        applyAdjustments({
          effectiveFrom: baselineFrom,
          cogsRub: 540,
          packagingRub: 19,
          handlingRub: 12,
          otherUnitCostRub: 8,
          notes: "Импульсный SKU с частыми промо-скидками",
          isComplete: true
        }),
        applyAdjustments({
          effectiveFrom: recentFrom,
          cogsRub: 590,
          packagingRub: 22,
          handlingRub: 14,
          otherUnitCostRub: 12,
          notes: "Новая партия пришла по более высокой цене",
          isComplete: true
        })
      ];
    default:
      {
        const numericId = Number(wbNmId);
        const variantIndex = Number.isNaN(numericId) ? 0 : numericId % 6;

        if (variantIndex === 0) {
          return [
            applyAdjustments({
              effectiveFrom: baselineFrom,
              cogsRub: 690,
              packagingRub: 32,
              handlingRub: 18,
              otherUnitCostRub: 20,
              notes: "Стабильный массовый SKU",
              isComplete: true
            })
          ];
        }

        if (variantIndex === 1) {
          return [
            applyAdjustments({
              effectiveFrom: baselineFrom,
              cogsRub: 620,
              packagingRub: 26,
              handlingRub: 16,
              otherUnitCostRub: 0,
              notes: "Часть дополнительных затрат пока не подтверждена",
              isComplete: false
            })
          ];
        }

        if (variantIndex === 2) {
          return [
            applyAdjustments({
              effectiveFrom: baselineFrom,
              cogsRub: 840,
              packagingRub: 34,
              handlingRub: 20,
              otherUnitCostRub: 18,
              notes: "Тонкая маржа и повышенная чувствительность к рекламе",
              isComplete: true
            }),
            applyAdjustments({
              effectiveFrom: recentFrom,
              cogsRub: 920,
              packagingRub: 37,
              handlingRub: 22,
              otherUnitCostRub: 22,
              notes: "Недавнее удорожание закупки",
              isComplete: true
            })
          ];
        }

        if (variantIndex === 3) {
          return [
            applyAdjustments({
              effectiveFrom: baselineFrom,
              cogsRub: 1040,
              packagingRub: 48,
              handlingRub: 28,
              otherUnitCostRub: 36,
              notes: "Высокий чек, дорогая логистика и контроль возвратов",
              isComplete: true
            })
          ];
        }

        if (variantIndex === 4) {
          return [
            applyAdjustments({
              effectiveFrom: baselineFrom,
              cogsRub: 760,
              packagingRub: 44,
              handlingRub: 24,
              otherUnitCostRub: 28,
              notes: "Габаритный SKU с заметной нагрузкой на логистику и хранение",
              isComplete: true
            })
          ];
        }

        return [
          applyAdjustments({
            effectiveFrom: baselineFrom,
            cogsRub: 540,
            packagingRub: 24,
            handlingRub: 12,
            otherUnitCostRub: 10,
            notes: "Импульсный SKU с промо и высокой волатильностью",
            isComplete: true
          }),
          applyAdjustments({
            effectiveFrom: recentFrom,
            cogsRub: 590,
            packagingRub: 26,
            handlingRub: 14,
            otherUnitCostRub: 14,
            notes: "Новая партия пришла по более высокой цене",
            isComplete: true
          })
        ];
      }
  }
}

export async function ensureDemoWorkspaceReady(scenarioKey: DemoScenarioKey = DEFAULT_DEMO_SCENARIO_KEY): Promise<DemoSeedResult> {
  const organization = await ensureDemoWorkspace();
  const scenario = getDemoScenario(scenarioKey);

  await resetDemoWorkspaceData(organization.id);

  let connectionCreated = false;
  let syncRunsCreated = 0;

  await connectWbAccount(
    {
      name: scenario.connectionName,
      apiToken: "demo-token-12345",
      cabinetId: scenario.cabinetId
    },
    { organizationId: organization.id }
  );
  connectionCreated = true;

  const today = startOfUtcDay(new Date());
  const historyFrom = addUtcDays(today, -29);
  await runWbSync({
    trigger: SyncTrigger.MANUAL,
    fromDate: historyFrom,
    toDate: today
  }, { organizationId: organization.id });
  syncRunsCreated += 1;

  const snapshotDate = today;
  await upsertCashInputs({
    snapshot: {
      snapshotDate,
      availableRub: scenario.snapshotRub,
      notes: `Демо-остаток для сценария «${scenario.label}»`
    },
    commitments: scenario.commitments.map((commitment) => ({
      title: commitment.title,
      commitmentType: commitment.commitmentType,
      dueDate: addUtcDays(today, commitment.dueInDays),
      amountRub: commitment.amountRub,
      notes: commitment.notes
    })),
    replaceCommitments: true
  }, { organizationId: organization.id });

  const skus = await prisma.sKU.findMany({
    where: { organizationId: organization.id },
    orderBy: { title: "asc" }
  });

  let costProfilesUpdated = 0;
  for (const sku of skus) {
    for (const profile of getDemoCostProfilesByNmId(sku.wbNmId, today, scenario.key)) {
      await upsertCostProfileAndRebuild(sku.id, profile, { organizationId: organization.id });
      costProfilesUpdated += 1;
    }
  }

  await runWbSync({
    trigger: SyncTrigger.MANUAL,
    fromDate: addUtcDays(today, -6),
    toDate: today
  }, { organizationId: organization.id });
  syncRunsCreated += 1;

  return {
    scenarioKey: scenario.key,
    connectionCreated,
    syncRunsCreated,
    costProfilesUpdated,
    commitmentsCreated: scenario.commitments.length
  };
}

export async function getDemoWorkspaceState(options?: { organizationId?: string }) {
  const organization = await resolveOrganizationContext({
    organizationId: options?.organizationId,
    fallback: "demo"
  });

  if (organization.workspaceKind !== "demo") {
    return null;
  }

  const connection = await prisma.wBConnection.findFirst({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "asc" }
  });
  const currentScenario = getDemoScenarioByCabinetId(connection?.cabinetId);

  return {
    currentScenario,
    scenarios: DEMO_SCENARIOS
  };
}
