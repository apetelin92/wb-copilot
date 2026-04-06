import { prisma } from "@/server/lib/prisma";
import { toNumber } from "@/server/lib/number";
import { startOfUtcDay } from "@/server/lib/date";
import { buildStartupAudit } from "@/server/modules/ops-audit/service";
import { assessSkuHealth } from "@/server/modules/sku/health";
import { resolveOrganizationContext } from "@/server/modules/workspace/context";

function sumMetric(items: Array<Record<string, unknown>>, key: string) {
  return items.reduce((total, item) => total + toNumber(item[key] as number | null | undefined), 0);
}

function buildActionCenter(input: {
  metrics: Array<{
    skuId: string;
    soldUnits: number;
    returnedUnits: number;
    contributionProfitRub: unknown;
    marginPct: unknown;
    hasIncompleteCosts: boolean;
    sku: { title: string };
  }>;
  risk: { riskLevel: string; explanation: string } | null;
  latestSync: { startedAt: Date } | null;
}) {
  const assessedMetrics = input.metrics.map((metric) => ({
    ...metric,
    health: assessSkuHealth({
      contributionProfitRub: toNumber(metric.contributionProfitRub as number | null | undefined),
      marginPct: toNumber(metric.marginPct as number | null | undefined),
      soldUnits: metric.soldUnits,
      returnedUnits: metric.returnedUnits,
      hasIncompleteCosts: metric.hasIncompleteCosts
    })
  }));
  const negativeSkus = assessedMetrics.filter((metric) => metric.health.status === "loss");
  const incompleteCostSkus = assessedMetrics.filter((metric) => metric.health.status === "incomplete");
  const atRiskSkus = assessedMetrics.filter((metric) => metric.health.status === "at_risk");
  const highReturnSku = assessedMetrics
    .filter((metric) => metric.soldUnits > 0)
    .sort((left, right) => right.health.returnRate - left.health.returnRate)[0];
  const isSyncStale = input.latestSync ? Date.now() - input.latestSync.startedAt.getTime() > 36 * 60 * 60 * 1000 : true;

  const actions = [] as Array<{
    id: string;
    title: string;
    description: string;
    tone: "success" | "warning" | "danger" | "info";
    href: string;
    ctaLabel: string;
  }>;

  if (input.risk?.riskLevel === "RISK") {
    actions.push({
      id: "cash-risk",
      title: "Срочно разберите кассовый риск",
      description: input.risk.explanation,
      tone: "danger",
      href: "/cash-gap",
      ctaLabel: "Открыть прогноз"
    });
  } else if (input.risk?.riskLevel === "WATCH") {
    actions.push({
      id: "cash-watch",
      title: "Проверьте ближайшие выплаты и списания",
      description: input.risk.explanation,
      tone: "warning",
      href: "/cash-gap",
      ctaLabel: "Проверить кассу"
    });
  }

  if (negativeSkus.length > 0) {
    actions.push({
      id: "negative-skus",
      title: `Есть ${negativeSkus.length} убыточных SKU`,
      description: `В первую очередь проверьте ${negativeSkus.slice(0, 3).map((item) => item.sku.title).join(", ")}. По ним прибыль уже ушла в минус.`,
      tone: "danger",
      href: "/skus?profitability=loss",
      ctaLabel: "Разобрать убыточные SKU"
    });
  }

  if (incompleteCostSkus.length > 0) {
    actions.push({
      id: "incomplete-costs",
      title: `Обновите себестоимость для ${incompleteCostSkus.length} SKU`,
      description: `Пока не заполнены затраты по ${incompleteCostSkus.slice(0, 3).map((item) => item.sku.title).join(", ")}, итоговая маржа может быть искажена.`,
      tone: "warning",
      href: "/skus?profitability=incomplete",
      ctaLabel: "Заполнить затраты"
    });
  }

  if (atRiskSkus.length > 0) {
    actions.push({
      id: "at-risk-skus",
      title: `${atRiskSkus.length} SKU под риском`,
      description: `Обратите внимание на ${atRiskSkus.slice(0, 3).map((item) => item.sku.title).join(", ")}. Пока они ещё не убыточны, но маржа уже слишком хрупкая.`,
      tone: "warning",
      href: "/skus?profitability=at_risk",
      ctaLabel: "Открыть проблемные SKU"
    });
  }

  if (highReturnSku && highReturnSku.health.returnRate >= 0.12) {
    actions.push({
      id: "returns",
      title: `Проверьте возвраты по ${highReturnSku.sku.title}`,
      description: `Возвраты по SKU выше ожидаемого уровня: ${highReturnSku.returnedUnits} из ${highReturnSku.soldUnits} продаж за день.`,
      tone: "info",
      href: `/skus/${highReturnSku.skuId}`,
      ctaLabel: "Открыть SKU"
    });
  }

  if (isSyncStale) {
    actions.push({
      id: "sync-stale",
      title: "Обновите данные перед созвоном",
      description: "Последняя синхронизация уже не свежая. Лучше показать клиенту актуальную картину по SKU и кассе.",
      tone: "info",
      href: "/settings",
      ctaLabel: "Запустить sync"
    });
  }

  if (actions.length === 0) {
    actions.push({
      id: "healthy",
      title: "Картина стабильна",
      description: "Сегодня можно сфокусироваться на масштабировании сильных SKU и контроле кассовой дисциплины.",
      tone: "success",
      href: "/skus?profitability=positive",
      ctaLabel: "Открыть лучшие SKU"
    });
  }

  return actions.slice(0, 5);
}

function buildDailyFocus(input: {
  dailyBrief: { headline: string; summary: string } | null;
  actionCenter: Array<{ title: string; description: string; tone: "success" | "warning" | "danger" | "info"; ctaLabel: string }>;
  risk: { riskLevel: string; explanation: string } | null;
}) {
  const topRisks = input.actionCenter.filter((item) => item.tone === "danger" || item.tone === "warning").slice(0, 3);
  const recommendedActions = input.actionCenter.slice(0, 3).map((item) => item.title);

  return {
    headline: input.dailyBrief?.headline ?? "Что важно сегодня",
    summary:
      input.dailyBrief?.summary ??
      (input.risk?.riskLevel === "RISK"
        ? "Сегодня главный фокус — защитить кассу и остановить убыточные SKU."
        : "Сегодня главный фокус — быстро разобрать проблемные SKU и обновить unit-экономику."),
    topRisks: topRisks.map((item) => item.description),
    recommendedActions
  };
}

function buildBusinessStatusSummary(input: {
  totalContributionRub: number;
  lossMakingSkuCount: number;
  atRiskSkuCount: number;
  cashGapRiskLevel?: string | null;
}) {
  if (input.totalContributionRub < 0) {
    return {
      tone: "danger" as const,
      title: "Сегодня прибыль под давлением",
      summary: `День уходит в минус по вкладу в прибыль. Убыточных SKU: ${input.lossMakingSkuCount}, под риском: ${input.atRiskSkuCount}.`
    };
  }

  if (input.lossMakingSkuCount > 0 || input.cashGapRiskLevel === "RISK") {
    return {
      tone: "warning" as const,
      title: "Сегодня есть точки потери прибыли",
      summary: `Прибыль пока положительная, но уже есть ${input.lossMakingSkuCount} убыточных SKU и ${input.atRiskSkuCount} SKU с хрупкой экономикой.`
    };
  }

  return {
    tone: "success" as const,
    title: "Сегодня вы зарабатываете",
    summary: `Вклад в прибыль положительный, убыточных SKU не видно, а кассовый риск не выглядит критичным.`
  };
}

export async function getDashboardData(asOfDate?: Date, options?: { organizationId?: string }) {
  const organization = await resolveOrganizationContext(options);
  const targetDate = startOfUtcDay(asOfDate ?? new Date());
  const [accountMetric, metrics, brief, risk, latestSync, completedSyncCount] = await Promise.all([
    prisma.dailyAccountMetric.findUnique({
      where: {
        organizationId_metricDate: {
          organizationId: organization.id,
          metricDate: targetDate
        }
      }
    }),
    prisma.dailySkuMetric.findMany({
      where: { organizationId: organization.id, metricDate: targetDate },
      include: { sku: true },
      orderBy: { contributionProfitRub: "desc" }
    }),
    prisma.dailyBrief.findUnique({
      where: {
        organizationId_briefDate: {
          organizationId: organization.id,
          briefDate: targetDate
        }
      }
    }),
    prisma.riskAssessment.findUnique({
      where: {
        organizationId_assessmentDate_windowDays: {
          organizationId: organization.id,
          assessmentDate: targetDate,
          windowDays: 14
        }
      },
      include: {
        projectionPoints: {
          orderBy: { projectionDate: "asc" }
        }
      }
    }),
    prisma.syncRun.findFirst({
      where: { organizationId: organization.id },
      orderBy: { startedAt: "desc" }
    }),
    prisma.syncRun.count({
      where: {
        organizationId: organization.id,
        status: "COMPLETED"
      }
    })
  ]);

  const topSkus = metrics.slice(0, 5);
  const bottomSkus = [...metrics].sort((left, right) => toNumber(left.contributionProfitRub) - toNumber(right.contributionProfitRub)).slice(0, 5);
  const assessedMetrics = metrics.map((metric) => ({
    ...metric,
    health: assessSkuHealth({
      contributionProfitRub: toNumber(metric.contributionProfitRub),
      marginPct: toNumber(metric.marginPct),
      soldUnits: metric.soldUnits,
      returnedUnits: metric.returnedUnits,
      hasIncompleteCosts: metric.hasIncompleteCosts
    })
  }));
  const discountAndRefundRub = sumMetric(metrics, "grossRevenueRub") - sumMetric(metrics, "netRevenueRub");
  const marketplaceCostsRub =
    sumMetric(metrics, "commissionRub") +
    sumMetric(metrics, "logisticsRub") +
    sumMetric(metrics, "storageRub") +
    sumMetric(metrics, "penaltyRub") +
    sumMetric(metrics, "returnCostRub");
  const productCostsRub =
    sumMetric(metrics, "cogsRub") +
    sumMetric(metrics, "packagingRub") +
    sumMetric(metrics, "handlingRub") +
    sumMetric(metrics, "otherUnitCostRub");
  const actionCenter = buildActionCenter({
    metrics,
    risk: risk ? { riskLevel: risk.riskLevel, explanation: risk.explanation } : null,
    latestSync: latestSync ? { startedAt: latestSync.startedAt } : null
  });
  const dailyFocus = buildDailyFocus({
    dailyBrief: brief ? { headline: brief.headline, summary: brief.summary } : null,
    actionCenter,
    risk: risk ? { riskLevel: risk.riskLevel, explanation: risk.explanation } : null
  });
  const lossMakingSkuCount = assessedMetrics.filter((item) => item.health.status === "loss").length;
  const incompleteEconomicsCount = assessedMetrics.filter((item) => item.health.status === "incomplete").length;
  const atRiskSkuCount = assessedMetrics.filter((item) => item.health.status === "at_risk").length;
  const attentionSkuCount = assessedMetrics.filter((item) => item.health.requiresAttention).length;
  const lossFromUnprofitableSkusRub = Math.abs(
    assessedMetrics
      .filter((item) => item.health.status === "loss")
      .reduce((total, item) => total + Math.min(toNumber(item.contributionProfitRub), 0), 0)
  );
  const businessStatus = buildBusinessStatusSummary({
    totalContributionRub: toNumber(accountMetric?.totalContributionRub),
    lossMakingSkuCount,
    atRiskSkuCount: attentionSkuCount,
    cashGapRiskLevel: risk?.riskLevel ?? null
  });
  const startupAudit = buildStartupAudit({
    metrics: assessedMetrics.map((item) => ({
      skuId: item.skuId,
      title: item.sku.title,
      contributionProfitRub: toNumber(item.contributionProfitRub),
      marginPct: toNumber(item.marginPct),
      soldUnits: item.soldUnits,
      returnedUnits: item.returnedUnits,
      hasIncompleteCosts: item.hasIncompleteCosts
    })),
    riskLevel: risk?.riskLevel ?? null,
    completedSyncCount
  });

  return {
    asOfDate: targetDate,
    businessStatus,
    startupAudit,
    overview: accountMetric
      ? {
          totalRevenueRub: toNumber(accountMetric.totalRevenueRub),
          totalContributionRub: toNumber(accountMetric.totalContributionRub),
          averageMarginPct: toNumber(accountMetric.averageMarginPct),
          profitableSkuCount: accountMetric.profitableSkuCount,
          lossMakingSkuCount,
          attentionSkuCount,
          atRiskSkuCount,
          incompleteEconomicsCount,
          lossFromUnprofitableSkusRub
        }
      : null,
    dailyFocus,
    actionCenter: actionCenter.slice(0, 3),
    profitExplainer: accountMetric
      ? {
          grossRevenueRub: sumMetric(metrics, "grossRevenueRub"),
          discountAndRefundRub,
          netRevenueRub: toNumber(accountMetric.totalRevenueRub),
          marketplaceCostsRub,
          productCostsRub,
          contributionProfitRub: toNumber(accountMetric.totalContributionRub)
        }
      : null,
    topSkus: topSkus.map((item) => ({
      skuId: item.skuId,
      title: item.sku.title,
      contributionProfitRub: toNumber(item.contributionProfitRub),
      marginPct: toNumber(item.marginPct),
      netRevenueRub: toNumber(item.netRevenueRub),
      hasIncompleteCosts: item.hasIncompleteCosts
    })),
    bottomSkus: bottomSkus.map((item) => ({
      skuId: item.skuId,
      title: item.sku.title,
      contributionProfitRub: toNumber(item.contributionProfitRub),
      marginPct: toNumber(item.marginPct),
      netRevenueRub: toNumber(item.netRevenueRub),
      hasIncompleteCosts: item.hasIncompleteCosts
    })),
    visualSummaries: {
      lossPreview: bottomSkus.map((item) => ({
        label: item.sku.title,
        value: toNumber(item.contributionProfitRub)
      })),
      cashPreview:
        risk?.projectionPoints.slice(0, 6).map((point) => ({
          label: point.projectionDate.toISOString().slice(5, 10),
          value: toNumber(point.projectedCashRub),
          tone: (toNumber(point.projectedCashRub) < 0 ? "danger" : risk.riskLevel === "WATCH" ? "warning" : "success") as "danger" | "warning" | "success"
        })) ?? []
    },
    dailyBrief: brief
      ? {
          id: brief.id,
          headline: brief.headline,
          summary: brief.summary,
          payload: brief.payload
        }
      : null,
    cashGapRisk: risk
      ? {
          riskLevel: risk.riskLevel,
          explanation: risk.explanation,
          minProjectedCashRub: toNumber(risk.minProjectedCashRub),
          points: risk.projectionPoints.map((point) => ({
            projectionDate: point.projectionDate,
            projectedCashRub: toNumber(point.projectedCashRub)
          }))
        }
      : null,
    latestSync: latestSync
      ? {
          id: latestSync.id,
          status: latestSync.status,
          startedAt: latestSync.startedAt,
          finishedAt: latestSync.finishedAt,
          errorMessage: latestSync.errorMessage,
          stats: latestSync.stats
        }
      : null
  };
}
