import { getAbcAnalysis } from "@/server/modules/abc/service";
import { startOfUtcDay } from "@/server/lib/date";
import { toNumber } from "@/server/lib/number";
import { prisma } from "@/server/lib/prisma";
import { assessSkuHealth, type SkuHealthStatus } from "@/server/modules/sku/health";
import { resolveOrganizationContext } from "@/server/modules/workspace/context";

const MS_IN_DAY = 24 * 60 * 60 * 1000;

export type SupplyStockMode = "lean" | "base" | "safe";
export type SupplyUrgency = "critical" | "watch" | "ok" | "overstock";
export type SupplyAbcFilter = "all" | "A" | "B" | "C";

function clampWindow(value?: number) {
  if (!value || Number.isNaN(value)) {
    return 14;
  }

  return Math.max(7, Math.min(60, Math.round(value)));
}

function clampHorizon(value?: number) {
  if (!value || Number.isNaN(value)) {
    return 21;
  }

  return Math.max(7, Math.min(60, Math.round(value)));
}

function inferCoverageDays(abcClass: "A" | "B" | "C", healthStatus: SkuHealthStatus, stockMode: SupplyStockMode) {
  const matrix = {
    lean: { A: 7, B: 5, C: 3 },
    base: { A: 11, B: 8, C: 5 },
    safe: { A: 17, B: 12, C: 8 }
  } as const;

  let coverage = matrix[stockMode][abcClass];

  if (healthStatus === "loss") {
    coverage -= 2;
  } else if (healthStatus === "at_risk" || healthStatus === "incomplete") {
    coverage -= 1;
  }

  return Math.max(2, coverage);
}

function getTargetCoverageDays(abcClass: "A" | "B" | "C", horizonDays: number) {
  if (abcClass === "A") {
    return horizonDays;
  }

  if (abcClass === "B") {
    return Math.max(10, horizonDays - 5);
  }

  return Math.max(7, horizonDays - 9);
}

function getLeadTimeDays(abcClass: "A" | "B" | "C") {
  if (abcClass === "A") {
    return 10;
  }

  if (abcClass === "B") {
    return 7;
  }

  return 5;
}

function getBufferDays(stockMode: SupplyStockMode, abcClass: "A" | "B" | "C") {
  const matrix = {
    lean: { A: 1, B: 1, C: 0 },
    base: { A: 3, B: 2, C: 1 },
    safe: { A: 5, B: 3, C: 2 }
  } as const;

  return matrix[stockMode][abcClass];
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * MS_IN_DAY);
}

function getUrgency(daysToZero: number, targetCoverageDays: number): SupplyUrgency {
  if (daysToZero <= 5) {
    return "critical";
  }

  if (daysToZero <= 10) {
    return "watch";
  }

  if (daysToZero > targetCoverageDays * 1.4) {
    return "overstock";
  }

  return "ok";
}

export async function getSupplyPlanningData(input?: {
  asOfDate?: Date;
  velocityWindowDays?: number;
  horizonDays?: number;
  stockMode?: SupplyStockMode;
  abcFilter?: SupplyAbcFilter;
  organizationId?: string;
}) {
  const organization = await resolveOrganizationContext({ organizationId: input?.organizationId });
  const asOfDate = startOfUtcDay(input?.asOfDate ?? new Date());
  const velocityWindowDays = clampWindow(input?.velocityWindowDays);
  const horizonDays = clampHorizon(input?.horizonDays);
  const stockMode = input?.stockMode ?? "base";
  const abcFilter = input?.abcFilter ?? "all";
  const fromDate = new Date(asOfDate.getTime() - (velocityWindowDays - 1) * MS_IN_DAY);

  const [abc, metrics] = await Promise.all([
    getAbcAnalysis({
      organizationId: organization.id,
      asOfDate,
      periodDays: Math.max(30, horizonDays),
      basis: "profit"
    }),
    prisma.dailySkuMetric.findMany({
      where: {
        organizationId: organization.id,
        metricDate: {
          gte: fromDate,
          lte: asOfDate
        }
      },
      include: {
        sku: true
      }
    })
  ]);

  const abcMap = new Map(
    abc.items.map((item) => [
      item.skuId,
      {
        abcClass: item.profitAbcClass,
        marginPct: item.marginPct,
        contributionProfitRub: item.contributionProfitRub,
        title: item.title,
        wbNmId: item.wbNmId
      }
    ])
  );

  const aggregated = new Map<
    string,
    {
      skuId: string;
      title: string;
      wbNmId: string;
      brand: string | null;
      subject: string | null;
      soldUnits: number;
      returnedUnits: number;
      netRevenueRub: number;
      contributionProfitRub: number;
      hasIncompleteCosts: boolean;
    }
  >();

  for (const metric of metrics) {
    const current = aggregated.get(metric.skuId);

    if (current) {
      current.soldUnits += metric.soldUnits;
      current.returnedUnits += metric.returnedUnits;
      current.netRevenueRub += toNumber(metric.netRevenueRub);
      current.contributionProfitRub += toNumber(metric.contributionProfitRub);
      current.hasIncompleteCosts = current.hasIncompleteCosts || metric.hasIncompleteCosts;
      continue;
    }

    aggregated.set(metric.skuId, {
      skuId: metric.skuId,
      title: metric.sku.title,
      wbNmId: metric.sku.wbNmId,
      brand: metric.sku.brand,
      subject: metric.sku.subject,
      soldUnits: metric.soldUnits,
      returnedUnits: metric.returnedUnits,
      netRevenueRub: toNumber(metric.netRevenueRub),
      contributionProfitRub: toNumber(metric.contributionProfitRub),
      hasIncompleteCosts: metric.hasIncompleteCosts
    });
  }

  const items = [...aggregated.values()]
    .map((item) => {
      const abcEntry = abcMap.get(item.skuId);
      const marginPct = item.netRevenueRub > 0 ? item.contributionProfitRub / item.netRevenueRub : 0;
      const health = assessSkuHealth({
        contributionProfitRub: item.contributionProfitRub,
        marginPct,
        soldUnits: item.soldUnits,
        returnedUnits: item.returnedUnits,
        hasIncompleteCosts: item.hasIncompleteCosts
      });
      const abcClass = abcEntry?.abcClass ?? "C";
      const dailySalesVelocity = item.soldUnits / velocityWindowDays;
      const estimatedCoverageDays = dailySalesVelocity > 0 ? inferCoverageDays(abcClass, health.status, stockMode) : 0;
      const estimatedStockUnits = Math.ceil(dailySalesVelocity * estimatedCoverageDays);
      const targetCoverageDays = getTargetCoverageDays(abcClass, horizonDays);
      const leadTimeDays = getLeadTimeDays(abcClass);
      const bufferDays = getBufferDays(stockMode, abcClass);
      const daysToZero = dailySalesVelocity > 0 ? estimatedStockUnits / dailySalesVelocity : 999;
      const projectedStockAtArrivalUnits = Math.max(0, Math.ceil(estimatedStockUnits - dailySalesVelocity * leadTimeDays));
      const recommendedReplenishmentUnits = Math.max(0, Math.ceil(dailySalesVelocity * targetCoverageDays - projectedStockAtArrivalUnits));
      const launchInDays = Math.max(0, Math.floor(daysToZero - leadTimeDays - bufferDays));
      const launchDate = addDays(asOfDate, launchInDays);
      const arrivalDate = addDays(launchDate, leadTimeDays);
      const urgency = getUrgency(daysToZero, targetCoverageDays);

      return {
        skuId: item.skuId,
        title: item.title,
        wbNmId: item.wbNmId,
        brand: item.brand,
        subject: item.subject,
        abcClass,
        healthStatus: health.status,
        healthLabel: health.statusLabel,
        marginPct,
        contributionProfitRub: item.contributionProfitRub,
        dailySalesVelocity,
        soldUnits: item.soldUnits,
        estimatedStockUnits,
        estimatedCoverageDays,
        targetCoverageDays,
        leadTimeDays,
        bufferDays,
        daysToZero,
        launchInDays,
        launchDate,
        arrivalDate,
        projectedStockAtArrivalUnits,
        recommendedReplenishmentUnits,
        urgency
      };
    })
    .filter((item) => item.dailySalesVelocity > 0)
    .filter((item) => (abcFilter === "all" ? true : item.abcClass === abcFilter))
    .sort((left, right) => {
      const urgencyOrder: Record<SupplyUrgency, number> = {
        critical: 0,
        watch: 1,
        ok: 2,
        overstock: 3
      };

      const urgencyDiff = urgencyOrder[left.urgency] - urgencyOrder[right.urgency];
      if (urgencyDiff !== 0) {
        return urgencyDiff;
      }

      if (left.abcClass !== right.abcClass) {
        return left.abcClass.localeCompare(right.abcClass);
      }

      return left.launchInDays - right.launchInDays || right.recommendedReplenishmentUnits - left.recommendedReplenishmentUnits;
    });

  return {
    asOfDate,
    velocityWindowDays,
    horizonDays,
    stockMode,
    abcFilter,
    items,
    summary: {
      skuCount: items.length,
      criticalCount: items.filter((item) => item.urgency === "critical").length,
      watchCount: items.filter((item) => item.urgency === "watch").length,
      protectedAItems: items.filter((item) => item.abcClass === "A").length,
      classCounts: {
        A: items.filter((item) => item.abcClass === "A").length,
        B: items.filter((item) => item.abcClass === "B").length,
        C: items.filter((item) => item.abcClass === "C").length
      },
      recommendedReplenishmentUnits: items.reduce((sum, item) => sum + item.recommendedReplenishmentUnits, 0)
    },
    highlights: {
      replenishFirst: items.filter((item) => item.recommendedReplenishmentUnits > 0).slice(0, 5),
      overstockTail: items.filter((item) => item.urgency === "overstock").slice(0, 5)
    }
  };
}
