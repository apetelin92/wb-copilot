import type { CostProfile } from "@prisma/client";

import { prisma } from "@/server/lib/prisma";
import { roundCurrency, toNumber } from "@/server/lib/number";
import { hasCompleteManualCosts } from "@/server/modules/costs/completeness";

type RebuildProfitabilityInput = {
  organizationId: string;
  fromDate: Date;
  toDate: Date;
};

type MetricAccumulator = {
  skuId: string;
  metricDate: Date;
  soldUnits: number;
  returnedUnits: number;
  grossRevenueRub: number;
  discountRub: number;
  refundRub: number;
  commissionRub: number;
  logisticsRub: number;
  storageRub: number;
  penaltyRub: number;
  returnCostRub: number;
};

function groupKey(skuId: string, metricDate: Date) {
  return `${skuId}:${metricDate.toISOString()}`;
}

function pickCostProfile(costProfiles: CostProfile[], metricDate: Date) {
  const timestamp = metricDate.getTime();

  return costProfiles
    .filter((profile) => profile.effectiveFrom.getTime() <= timestamp)
    .sort((left, right) => right.effectiveFrom.getTime() - left.effectiveFrom.getTime())[0];
}

export async function rebuildDailyProfitability(input: RebuildProfitabilityInput) {
  const records = await prisma.normalizedFinancialRecord.findMany({
    where: {
      organizationId: input.organizationId,
      recordDate: {
        gte: input.fromDate,
        lte: input.toDate
      }
    },
    orderBy: [{ recordDate: "asc" }]
  });

  const skuIds = [...new Set(records.map((record) => record.skuId))];
  const costProfiles = await prisma.costProfile.findMany({
    where: {
      organizationId: input.organizationId,
      skuId: { in: skuIds }
    },
    orderBy: [{ effectiveFrom: "desc" }]
  });

  const costProfilesBySku = new Map<string, CostProfile[]>();
  costProfiles.forEach((profile) => {
    const existing = costProfilesBySku.get(profile.skuId) ?? [];
    existing.push(profile);
    costProfilesBySku.set(profile.skuId, existing);
  });

  const grouped = new Map<string, MetricAccumulator>();
  for (const record of records) {
    const key = groupKey(record.skuId, record.recordDate);
    const bucket = grouped.get(key) ?? {
      skuId: record.skuId,
      metricDate: record.recordDate,
      soldUnits: 0,
      returnedUnits: 0,
      grossRevenueRub: 0,
      discountRub: 0,
      refundRub: 0,
      commissionRub: 0,
      logisticsRub: 0,
      storageRub: 0,
      penaltyRub: 0,
      returnCostRub: 0
    };

    bucket.soldUnits += record.soldUnits;
    bucket.returnedUnits += record.returnedUnits;
    bucket.grossRevenueRub += toNumber(record.grossRevenueRub);
    bucket.discountRub += toNumber(record.discountRub);
    bucket.refundRub += toNumber(record.refundRub);
    bucket.commissionRub += toNumber(record.commissionRub);
    bucket.logisticsRub += toNumber(record.logisticsRub);
    bucket.storageRub += toNumber(record.storageRub);
    bucket.penaltyRub += toNumber(record.penaltyRub);
    bucket.returnCostRub += toNumber(record.returnCostRub);

    grouped.set(key, bucket);
  }

  const skuMetrics = [...grouped.values()].map((item) => {
    const applicableCost = pickCostProfile(costProfilesBySku.get(item.skuId) ?? [], item.metricDate);
    const netUnits = item.soldUnits - item.returnedUnits;
    const recognizedUnits = Math.max(netUnits, 0);
    const cogsRub = recognizedUnits * toNumber(applicableCost?.cogsRub);
    const packagingRub = recognizedUnits * toNumber(applicableCost?.packagingRub);
    const handlingRub = recognizedUnits * toNumber(applicableCost?.handlingRub);
    const otherUnitCostRub = recognizedUnits * toNumber(applicableCost?.otherUnitCostRub);
    const netRevenueRub = item.grossRevenueRub - item.discountRub - item.refundRub;
    const contributionProfitRub =
      netRevenueRub -
      item.commissionRub -
      item.logisticsRub -
      item.storageRub -
      item.penaltyRub -
      item.returnCostRub -
      cogsRub -
      packagingRub -
      handlingRub -
      otherUnitCostRub;
    const marginPct = netRevenueRub > 0 ? contributionProfitRub / netRevenueRub : 0;

    return {
      organizationId: input.organizationId,
      skuId: item.skuId,
      metricDate: item.metricDate,
      soldUnits: item.soldUnits,
      returnedUnits: item.returnedUnits,
      netUnits,
      grossRevenueRub: roundCurrency(item.grossRevenueRub),
      netRevenueRub: roundCurrency(netRevenueRub),
      commissionRub: roundCurrency(item.commissionRub),
      logisticsRub: roundCurrency(item.logisticsRub),
      storageRub: roundCurrency(item.storageRub),
      penaltyRub: roundCurrency(item.penaltyRub),
      returnCostRub: roundCurrency(item.returnCostRub),
      cogsRub: roundCurrency(cogsRub),
      packagingRub: roundCurrency(packagingRub),
      handlingRub: roundCurrency(handlingRub),
      otherUnitCostRub: roundCurrency(otherUnitCostRub),
      contributionProfitRub: roundCurrency(contributionProfitRub),
      marginPct,
      hasIncompleteCosts: !hasCompleteManualCosts(applicableCost)
    };
  });

  await prisma.$transaction(async (tx) => {
    await tx.dailySkuMetric.deleteMany({
      where: {
        organizationId: input.organizationId,
        metricDate: {
          gte: input.fromDate,
          lte: input.toDate
        }
      }
    });

    if (skuMetrics.length > 0) {
      await tx.dailySkuMetric.createMany({
        data: skuMetrics
      });
    }

    await tx.dailyAccountMetric.deleteMany({
      where: {
        organizationId: input.organizationId,
        metricDate: {
          gte: input.fromDate,
          lte: input.toDate
        }
      }
    });

    const dailyBuckets = new Map<string, { metricDate: Date; revenue: number; contribution: number; profitable: number; lossMaking: number }>();

    skuMetrics.forEach((metric) => {
      const key = metric.metricDate.toISOString();
      const bucket = dailyBuckets.get(key) ?? {
        metricDate: metric.metricDate,
        revenue: 0,
        contribution: 0,
        profitable: 0,
        lossMaking: 0
      };

      bucket.revenue += metric.netRevenueRub;
      bucket.contribution += metric.contributionProfitRub;
      if (metric.contributionProfitRub >= 0) {
        bucket.profitable += 1;
      } else {
        bucket.lossMaking += 1;
      }

      dailyBuckets.set(key, bucket);
    });

    if (dailyBuckets.size > 0) {
      await tx.dailyAccountMetric.createMany({
        data: [...dailyBuckets.values()].map((bucket) => ({
          organizationId: input.organizationId,
          metricDate: bucket.metricDate,
          totalRevenueRub: roundCurrency(bucket.revenue),
          totalContributionRub: roundCurrency(bucket.contribution),
          averageMarginPct: bucket.revenue > 0 ? bucket.contribution / bucket.revenue : 0,
          profitableSkuCount: bucket.profitable,
          lossMakingSkuCount: bucket.lossMaking
        }))
      });
    }
  });

  return {
    dailySkuMetricsCount: skuMetrics.length
  };
}
