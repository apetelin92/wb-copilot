import { AppError } from "@/server/lib/errors";
import { startOfUtcDay } from "@/server/lib/date";
import { prisma } from "@/server/lib/prisma";
import { toNumber } from "@/server/lib/number";
import { calculateUnitEconomics } from "@/lib/unit-economics/calculator";
import type { UnitEconomicsInput } from "@/lib/unit-economics/types";
import { getMissingManualCostFields } from "@/server/modules/costs/completeness";
import { resolveOrganizationContext } from "@/server/modules/workspace/context";
import { ensureSkuInsight } from "@/server/modules/insights/service";
import { assessSkuHealth } from "@/server/modules/sku/health";

export type SkuListFilter = "attention" | "loss" | "incomplete" | "at_risk" | "positive" | "all";

function getStatusPriority(status: string) {
  const statusPriority: Record<string, number> = {
    loss: 0,
    incomplete: 1,
    at_risk: 2,
    profitable: 3
  };

  return statusPriority[status] ?? 4;
}

function sortSkuItemsForFilter<
  T extends {
    healthStatus: string;
    hasIncompleteCosts: boolean;
    contributionProfitRub: number;
    marginPct: number;
    netRevenueRub: number;
  }
>(items: T[], profitability: SkuListFilter) {
  return [...items].sort((left, right) => {
    if (profitability === "loss") {
      return left.contributionProfitRub - right.contributionProfitRub || left.marginPct - right.marginPct;
    }

    if (profitability === "incomplete") {
      return right.netRevenueRub - left.netRevenueRub || left.contributionProfitRub - right.contributionProfitRub;
    }

    if (profitability === "at_risk") {
      return left.marginPct - right.marginPct || right.netRevenueRub - left.netRevenueRub;
    }

    if (profitability === "positive") {
      return right.contributionProfitRub - left.contributionProfitRub || right.netRevenueRub - left.netRevenueRub;
    }

    if (profitability === "attention") {
      const leftPriority =
        left.healthStatus === "loss" ? 0 : left.hasIncompleteCosts ? 1 : left.healthStatus === "at_risk" ? 2 : 3;
      const rightPriority =
        right.healthStatus === "loss" ? 0 : right.hasIncompleteCosts ? 1 : right.healthStatus === "at_risk" ? 2 : 3;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      if (leftPriority === 0) {
        return left.contributionProfitRub - right.contributionProfitRub;
      }

      if (leftPriority === 1) {
        return right.netRevenueRub - left.netRevenueRub;
      }

      if (leftPriority === 2) {
        return left.marginPct - right.marginPct;
      }

      return right.contributionProfitRub - left.contributionProfitRub;
    }

    const priorityDiff = getStatusPriority(left.healthStatus) - getStatusPriority(right.healthStatus);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    if (left.healthStatus === "loss" && right.healthStatus === "loss") {
      return left.contributionProfitRub - right.contributionProfitRub;
    }

    if (left.healthStatus === "incomplete" && right.healthStatus === "incomplete") {
      return right.netRevenueRub - left.netRevenueRub;
    }

    if (left.healthStatus === "at_risk" && right.healthStatus === "at_risk") {
      return left.marginPct - right.marginPct;
    }

    return right.contributionProfitRub - left.contributionProfitRub;
  });
}

function getMissingEconomicsFields(input: {
  hasMetric: boolean;
  hasIncompleteCosts: boolean;
  latestCostProfile: {
    cogsRub: number;
    packagingRub: number;
    handlingRub: number;
    otherUnitCostRub: number;
    isComplete: boolean;
  } | null;
}) {
  if (!input.hasMetric || !input.hasIncompleteCosts) {
    return [] as string[];
  }

  if (!input.latestCostProfile) {
    return ["себестоимость", "упаковка", "обработка", "прочие ручные затраты"];
  }

  const missing = getMissingManualCostFields(input.latestCostProfile);

  return missing.length > 0 ? missing : ["часть ручных допущений по затратам"];
}

function buildCalculatorPrefill(input: {
  skuTitle: string;
  metric: {
    soldUnits: number;
    netUnits: number;
    netRevenueRub: number;
    commissionRub: number;
    logisticsRub: number;
    storageRub: number;
    returnCostRub: number;
    cogsRub: number;
    packagingRub: number;
    handlingRub: number;
    otherUnitCostRub: number;
  };
}): UnitEconomicsInput {
  const recognizedUnits = Math.max(input.metric.netUnits, input.metric.soldUnits, 1);

  return {
    skuName: input.skuTitle,
    marketplacePreset: "wildberries",
    salePrice: Number((input.metric.netRevenueRub / recognizedUnits).toFixed(2)),
    costPrice: Number((input.metric.cogsRub / recognizedUnits).toFixed(2)),
    commissionMode: "amount",
    commissionValue: Number((input.metric.commissionRub / recognizedUnits).toFixed(2)),
    logisticsCost: Number((input.metric.logisticsRub / recognizedUnits).toFixed(2)),
    storageCost: Number((input.metric.storageRub / recognizedUnits).toFixed(2)),
    packagingCost: Number((input.metric.packagingRub / recognizedUnits).toFixed(2)),
    handlingCost: Number((input.metric.handlingRub / recognizedUnits).toFixed(2)),
    adsCost: 0,
    returnsCost: Number((input.metric.returnCostRub / recognizedUnits).toFixed(2)),
    otherCosts: Number((input.metric.otherUnitCostRub / recognizedUnits).toFixed(2)),
    taxMode: "percent",
    taxValue: 0,
    discountMode: "amount",
    discountValue: 0
  };
}

export async function listSkuProfitability(input?: { asOfDate?: Date; profitability?: SkuListFilter; organizationId?: string }) {
  const organization = await resolveOrganizationContext({ organizationId: input?.organizationId });
  const metricDate = startOfUtcDay(input?.asOfDate ?? new Date());
  const profitability = input?.profitability ?? "attention";

  const metrics = await prisma.dailySkuMetric.findMany({
    where: {
      organizationId: organization.id,
      metricDate
    },
    include: { sku: true },
    orderBy: [{ contributionProfitRub: "asc" }]
  });

  const items = metrics.map((metric) => {
    const health = assessSkuHealth({
      contributionProfitRub: toNumber(metric.contributionProfitRub),
      marginPct: toNumber(metric.marginPct),
      soldUnits: metric.soldUnits,
      returnedUnits: metric.returnedUnits,
      hasIncompleteCosts: metric.hasIncompleteCosts
    });

    return {
      skuId: metric.skuId,
      wbNmId: metric.sku.wbNmId,
      title: metric.sku.title,
      vendorCode: metric.sku.vendorCode,
      netRevenueRub: toNumber(metric.netRevenueRub),
      contributionProfitRub: toNumber(metric.contributionProfitRub),
      marginPct: toNumber(metric.marginPct),
      soldUnits: metric.soldUnits,
      returnedUnits: metric.returnedUnits,
      hasIncompleteCosts: metric.hasIncompleteCosts,
      healthStatus: health.status,
      healthLabel: health.statusLabel,
      requiresAttention: health.requiresAttention,
      primaryReason: health.reason,
      recommendedAction: health.action,
      returnRate: health.returnRate
    };
  });

  const filteredItems = items.filter((item) => {
    if (profitability === "all") {
      return true;
    }

    if (profitability === "attention") {
      return item.requiresAttention;
    }

    if (profitability === "loss") {
      return item.healthStatus === "loss";
    }

    if (profitability === "incomplete") {
      return item.hasIncompleteCosts;
    }

    if (profitability === "at_risk") {
      return item.healthStatus === "at_risk";
    }

    if (profitability === "positive") {
      return item.healthStatus === "profitable";
    }

    return true;
  });

  const sortedItems = sortSkuItemsForFilter(filteredItems, profitability);

  return {
    items: sortedItems,
    summary: {
      allCount: items.length,
      attentionCount: items.filter((item) => item.requiresAttention).length,
      lossCount: items.filter((item) => item.healthStatus === "loss").length,
      incompleteCount: items.filter((item) => item.healthStatus === "incomplete").length,
      atRiskCount: items.filter((item) => item.healthStatus === "at_risk").length,
      profitableCount: items.filter((item) => item.healthStatus === "profitable").length
    }
  };
}

export async function listIncompleteEconomicsQueue(input?: { asOfDate?: Date; organizationId?: string }) {
  const organization = await resolveOrganizationContext({ organizationId: input?.organizationId });
  const metricDate = startOfUtcDay(input?.asOfDate ?? new Date());
  const metrics = await prisma.dailySkuMetric.findMany({
    where: {
      organizationId: organization.id,
      metricDate,
      hasIncompleteCosts: true
    },
    include: { sku: true },
    orderBy: [{ netRevenueRub: "desc" }]
  });

  if (metrics.length === 0) {
    return [] as Array<{
      skuId: string;
      title: string;
      vendorCode: string | null;
      missingFields: string[];
      recommendation: string;
    }>;
  }

  const skuIds = metrics.map((metric) => metric.skuId);
  const costProfiles = await prisma.costProfile.findMany({
    where: {
      organizationId: organization.id,
      skuId: { in: skuIds },
      effectiveFrom: {
        lte: metricDate
      }
    },
    orderBy: [{ skuId: "asc" }, { effectiveFrom: "desc" }]
  });

  const latestProfileBySkuId = new Map<string, (typeof costProfiles)[number]>();
  for (const profile of costProfiles) {
    if (!latestProfileBySkuId.has(profile.skuId)) {
      latestProfileBySkuId.set(profile.skuId, profile);
    }
  }

  return metrics.map((metric) => {
    const latestCostProfile = latestProfileBySkuId.get(metric.skuId);
    const missingFields = getMissingEconomicsFields({
      hasMetric: true,
      hasIncompleteCosts: metric.hasIncompleteCosts,
      latestCostProfile: latestCostProfile
        ? {
            cogsRub: toNumber(latestCostProfile.cogsRub),
            packagingRub: toNumber(latestCostProfile.packagingRub),
            handlingRub: toNumber(latestCostProfile.handlingRub),
            otherUnitCostRub: toNumber(latestCostProfile.otherUnitCostRub),
            isComplete: latestCostProfile.isComplete
          }
        : null
    });

    return {
      skuId: metric.skuId,
      title: metric.sku.title,
      vendorCode: metric.sku.vendorCode,
      missingFields,
      recommendation: `Заполните: ${missingFields.join(", ")}. Пока эти поля не заполнены, прибыль по SKU может быть искажена.`
    };
  });
}

export async function getSkuDetail(skuId: string, input?: { asOfDate?: Date; days?: number; organizationId?: string }) {
  const organization = await resolveOrganizationContext({ organizationId: input?.organizationId });
  const asOfDate = startOfUtcDay(input?.asOfDate ?? new Date());
  const days = input?.days ?? 30;
  const fromDate = new Date(asOfDate.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const sku = await prisma.sKU.findFirst({
    where: { id: skuId, organizationId: organization.id }
  });

  if (!sku) {
    throw new AppError(404, "sku_not_found", "SKU not found.");
  }

  const [metric, previousMetric, series, latestCostProfile] = await Promise.all([
    prisma.dailySkuMetric.findUnique({
      where: {
        organizationId_skuId_metricDate: {
          organizationId: organization.id,
          skuId,
          metricDate: asOfDate
        }
      }
    }),
    prisma.dailySkuMetric.findFirst({
      where: {
        organizationId: organization.id,
        skuId,
        metricDate: {
          lt: asOfDate
        }
      },
      orderBy: { metricDate: "desc" }
    }),
    prisma.dailySkuMetric.findMany({
      where: {
        organizationId: organization.id,
        skuId,
        metricDate: {
          gte: fromDate,
          lte: asOfDate
        }
      },
      orderBy: { metricDate: "asc" }
    }),
    prisma.costProfile.findFirst({
      where: {
        organizationId: organization.id,
        skuId,
        effectiveFrom: {
          lte: asOfDate
        }
      },
      orderBy: { effectiveFrom: "desc" }
    })
  ]);

  const insight = await ensureSkuInsight({ organizationId: organization.id, skuId, asOfDate });
  const health = metric
    ? assessSkuHealth({
        contributionProfitRub: toNumber(metric.contributionProfitRub),
        marginPct: toNumber(metric.marginPct),
        soldUnits: metric.soldUnits,
        returnedUnits: metric.returnedUnits,
        hasIncompleteCosts: metric.hasIncompleteCosts
      })
    : null;
  const previousContribution = previousMetric ? toNumber(previousMetric.contributionProfitRub) : null;
  const contributionDelta = previousContribution === null || !metric ? null : toNumber(metric.contributionProfitRub) - previousContribution;
  const changeText =
    contributionDelta === null
      ? "без сравнения с предыдущим днём"
      : contributionDelta > 0
        ? `лучше прошлого дня на ${contributionDelta.toFixed(0)} ₽`
        : contributionDelta < 0
          ? `хуже прошлого дня на ${Math.abs(contributionDelta).toFixed(0)} ₽`
          : "на уровне прошлого дня";
  const missingEconomicsFields = getMissingEconomicsFields({
    hasMetric: Boolean(metric),
    hasIncompleteCosts: Boolean(metric?.hasIncompleteCosts),
    latestCostProfile: latestCostProfile
      ? {
          cogsRub: toNumber(latestCostProfile.cogsRub),
          packagingRub: toNumber(latestCostProfile.packagingRub),
          handlingRub: toNumber(latestCostProfile.handlingRub),
          otherUnitCostRub: toNumber(latestCostProfile.otherUnitCostRub),
          isComplete: latestCostProfile.isComplete
        }
      : null
  });

  return {
    sku: {
      id: sku.id,
      wbNmId: sku.wbNmId,
      vendorCode: sku.vendorCode,
      title: sku.title,
      brand: sku.brand,
      subject: sku.subject,
      status: sku.status
    },
    metric: metric
      ? {
          metricDate: metric.metricDate,
          soldUnits: metric.soldUnits,
          returnedUnits: metric.returnedUnits,
          netUnits: metric.netUnits,
          netRevenueRub: toNumber(metric.netRevenueRub),
          contributionProfitRub: toNumber(metric.contributionProfitRub),
          marginPct: toNumber(metric.marginPct),
          commissionRub: toNumber(metric.commissionRub),
          logisticsRub: toNumber(metric.logisticsRub),
          storageRub: toNumber(metric.storageRub),
          penaltyRub: toNumber(metric.penaltyRub),
          returnCostRub: toNumber(metric.returnCostRub),
          cogsRub: toNumber(metric.cogsRub),
          packagingRub: toNumber(metric.packagingRub),
          handlingRub: toNumber(metric.handlingRub),
          otherUnitCostRub: toNumber(metric.otherUnitCostRub),
          hasIncompleteCosts: metric.hasIncompleteCosts
        }
      : null,
    metricExplainer: metric
      ? {
          grossRevenueRub: toNumber(metric.grossRevenueRub),
          discountsAndRefundsRub: toNumber(metric.grossRevenueRub) - toNumber(metric.netRevenueRub),
          netRevenueRub: toNumber(metric.netRevenueRub),
          marketplaceCostsRub:
            toNumber(metric.commissionRub) +
            toNumber(metric.logisticsRub) +
            toNumber(metric.storageRub) +
            toNumber(metric.penaltyRub) +
            toNumber(metric.returnCostRub),
          productCostsRub:
            toNumber(metric.cogsRub) +
            toNumber(metric.packagingRub) +
            toNumber(metric.handlingRub) +
            toNumber(metric.otherUnitCostRub),
          contributionProfitRub: toNumber(metric.contributionProfitRub)
        }
      : null,
    decisionSupport: metric && health
      ? {
          status: health.status,
          statusLabel: health.statusLabel,
          reason: health.reason,
          action: health.action,
          whatHappened: `${sku.title} дал ${toNumber(metric.contributionProfitRub).toFixed(0)} ₽ вклада в прибыль при марже ${(toNumber(metric.marginPct) * 100).toFixed(1)}% и ${changeText}.`,
          why: health.reason,
          whatToDo: health.action
        }
      : null,
    incompleteEconomics:
      metric?.hasIncompleteCosts
        ? {
            missingFields: missingEconomicsFields,
            summary:
              missingEconomicsFields.length > 0
                ? `Экономика по SKU пока неполная: не заполнены ${missingEconomicsFields.join(", ")}. Пока эти данные не подтверждены, итоговая прибыль может быть завышена.`
                : "Экономика по SKU пока неполная: часть ручных затрат ещё не подтверждена."
          }
        : null,
    calculatorPreview: metric
      ? (() => {
          const input = buildCalculatorPrefill({
            skuTitle: sku.title,
            metric: {
              soldUnits: metric.soldUnits,
              netUnits: metric.netUnits,
              netRevenueRub: toNumber(metric.netRevenueRub),
              commissionRub: toNumber(metric.commissionRub),
              logisticsRub: toNumber(metric.logisticsRub),
              storageRub: toNumber(metric.storageRub),
              returnCostRub: toNumber(metric.returnCostRub),
              cogsRub: toNumber(metric.cogsRub),
              packagingRub: toNumber(metric.packagingRub),
              handlingRub: toNumber(metric.handlingRub),
              otherUnitCostRub: toNumber(metric.otherUnitCostRub)
            }
          });
          const result = calculateUnitEconomics(input);

          return {
            input,
            breakEvenPrice: result.breakEvenPrice,
            maxAdSpend: result.maxAdSpend,
            maxCostPrice: result.maxCostPrice,
            breakdown: [
              { label: "Себестоимость", value: input.costPrice },
              { label: "Комиссия", value: input.commissionValue },
              { label: "Логистика", value: input.logisticsCost },
              { label: "Хранение", value: input.storageCost },
              { label: "Упаковка", value: input.packagingCost },
              { label: "Обработка", value: input.handlingCost },
              { label: "Возвраты", value: input.returnsCost },
              { label: "Прочие", value: input.otherCosts }
            ].filter((item) => item.value > 0)
          };
        })()
      : null,
    series: series.map((item) => ({
      metricDate: item.metricDate,
      netRevenueRub: toNumber(item.netRevenueRub),
      contributionProfitRub: toNumber(item.contributionProfitRub),
      marginPct: toNumber(item.marginPct)
    })),
    latestCostProfile: latestCostProfile
      ? {
          id: latestCostProfile.id,
          effectiveFrom: latestCostProfile.effectiveFrom,
          cogsRub: toNumber(latestCostProfile.cogsRub),
          packagingRub: toNumber(latestCostProfile.packagingRub),
          handlingRub: toNumber(latestCostProfile.handlingRub),
          otherUnitCostRub: toNumber(latestCostProfile.otherUnitCostRub),
          isComplete: latestCostProfile.isComplete,
          notes: latestCostProfile.notes
        }
      : null,
    insight: insight
      ? {
          title: insight.title,
          content: insight.content,
          status: insight.status,
          createdAt: insight.createdAt
        }
      : null
  };
}
