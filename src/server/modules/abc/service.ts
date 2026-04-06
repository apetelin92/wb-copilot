import { startOfUtcDay } from "@/server/lib/date";
import { toNumber } from "@/server/lib/number";
import { prisma } from "@/server/lib/prisma";
import { resolveOrganizationContext } from "@/server/modules/workspace/context";

const MS_IN_DAY = 24 * 60 * 60 * 1000;

export type AbcBasis = "revenue" | "profit";
export type AbcClass = "A" | "B" | "C";

type AggregatedSku = {
  skuId: string;
  wbNmId: string;
  title: string;
  brand: string | null;
  subject: string | null;
  soldUnits: number;
  returnedUnits: number;
  netRevenueRub: number;
  contributionProfitRub: number;
};

function clampPeriodDays(value?: number) {
  if (!value || Number.isNaN(value)) {
    return 30;
  }

  return Math.max(7, Math.min(180, Math.round(value)));
}

function classifyAbc(items: AggregatedSku[], basis: AbcBasis) {
  const sortedItems = [...items].sort((left, right) => {
    const leftValue = basis === "revenue" ? left.netRevenueRub : left.contributionProfitRub;
    const rightValue = basis === "revenue" ? right.netRevenueRub : right.contributionProfitRub;

    return rightValue - leftValue;
  });

  const totalPositiveValue = sortedItems.reduce((sum, item) => {
    const rawValue = basis === "revenue" ? item.netRevenueRub : item.contributionProfitRub;
    return sum + Math.max(rawValue, 0);
  }, 0);

  let cumulativeShare = 0;

  return sortedItems.map((item) => {
    const rawValue = basis === "revenue" ? item.netRevenueRub : item.contributionProfitRub;
    const positiveValue = Math.max(rawValue, 0);
    const share = totalPositiveValue > 0 ? positiveValue / totalPositiveValue : 0;
    const previousShare = cumulativeShare;
    cumulativeShare += share;

    let abcClass: AbcClass = "C";
    if (positiveValue > 0) {
      if (previousShare < 0.8) {
        abcClass = "A";
      } else if (previousShare < 0.95) {
        abcClass = "B";
      }
    }

    return {
      skuId: item.skuId,
      abcClass,
      basisValue: rawValue,
      share,
      cumulativeShare
    };
  });
}

export async function getAbcAnalysis(input?: {
  asOfDate?: Date;
  periodDays?: number;
  basis?: AbcBasis;
  organizationId?: string;
}) {
  const organization = await resolveOrganizationContext({ organizationId: input?.organizationId });
  const asOfDate = startOfUtcDay(input?.asOfDate ?? new Date());
  const periodDays = clampPeriodDays(input?.periodDays);
  const basis = input?.basis ?? "profit";
  const fromDate = new Date(asOfDate.getTime() - (periodDays - 1) * MS_IN_DAY);

  const metrics = await prisma.dailySkuMetric.findMany({
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
  });

  const aggregated = new Map<string, AggregatedSku>();

  for (const metric of metrics) {
    const existing = aggregated.get(metric.skuId);

    if (existing) {
      existing.soldUnits += metric.soldUnits;
      existing.returnedUnits += metric.returnedUnits;
      existing.netRevenueRub += toNumber(metric.netRevenueRub);
      existing.contributionProfitRub += toNumber(metric.contributionProfitRub);
      continue;
    }

    aggregated.set(metric.skuId, {
      skuId: metric.skuId,
      wbNmId: metric.sku.wbNmId,
      title: metric.sku.title,
      brand: metric.sku.brand,
      subject: metric.sku.subject,
      soldUnits: metric.soldUnits,
      returnedUnits: metric.returnedUnits,
      netRevenueRub: toNumber(metric.netRevenueRub),
      contributionProfitRub: toNumber(metric.contributionProfitRub)
    });
  }

  const items = [...aggregated.values()];
  const revenueClassification = classifyAbc(items, "revenue");
  const profitClassification = classifyAbc(items, "profit");
  const revenueMap = new Map(revenueClassification.map((item) => [item.skuId, item]));
  const profitMap = new Map(profitClassification.map((item) => [item.skuId, item]));

  const rankedItems = items
    .map((item) => {
      const revenue = revenueMap.get(item.skuId);
      const profit = profitMap.get(item.skuId);

      return {
        ...item,
        marginPct: item.netRevenueRub > 0 ? item.contributionProfitRub / item.netRevenueRub : 0,
        revenueAbcClass: revenue?.abcClass ?? "C",
        revenueShare: revenue?.share ?? 0,
        revenueCumulativeShare: revenue?.cumulativeShare ?? 0,
        profitAbcClass: profit?.abcClass ?? "C",
        profitShare: profit?.share ?? 0,
        profitCumulativeShare: profit?.cumulativeShare ?? 0
      };
    })
    .sort((left, right) => {
      const leftValue = basis === "revenue" ? left.netRevenueRub : left.contributionProfitRub;
      const rightValue = basis === "revenue" ? right.netRevenueRub : right.contributionProfitRub;

      return rightValue - leftValue;
    });

  const totalRevenueRub = rankedItems.reduce((sum, item) => sum + item.netRevenueRub, 0);
  const totalContributionProfitRub = rankedItems.reduce((sum, item) => sum + item.contributionProfitRub, 0);
  const selectedClassKey = basis === "revenue" ? "revenueAbcClass" : "profitAbcClass";
  const selectedShareKey = basis === "revenue" ? "revenueShare" : "profitShare";
  const classCounts = {
    A: rankedItems.filter((item) => item[selectedClassKey] === "A").length,
    B: rankedItems.filter((item) => item[selectedClassKey] === "B").length,
    C: rankedItems.filter((item) => item[selectedClassKey] === "C").length
  };
  const aClassShare = rankedItems
    .filter((item) => item[selectedClassKey] === "A")
    .reduce((sum, item) => sum + item[selectedShareKey], 0);

  return {
    basis,
    periodDays,
    fromDate,
    asOfDate,
    items: rankedItems,
    summary: {
      skuCount: rankedItems.length,
      totalRevenueRub,
      totalContributionProfitRub,
      aClassShare,
      averageMarginPct: totalRevenueRub > 0 ? totalContributionProfitRub / totalRevenueRub : 0,
      classCounts
    },
    highlights: {
      topAItems: rankedItems.filter((item) => item[selectedClassKey] === "A").slice(0, 5),
      weakBItems: rankedItems.filter((item) => item[selectedClassKey] === "B" && item.marginPct < 0.18).slice(0, 5),
      lowValueCItems: rankedItems.filter((item) => item[selectedClassKey] === "C").slice(-5).reverse()
    }
  };
}
