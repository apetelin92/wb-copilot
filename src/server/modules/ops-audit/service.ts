import { assessSkuHealth } from "../sku/health";

export type StartupAuditMetric = {
  skuId: string;
  title: string;
  contributionProfitRub: number;
  marginPct: number;
  soldUnits: number;
  returnedUnits: number;
  hasIncompleteCosts: boolean;
};

export type StartupAuditInput = {
  metrics: StartupAuditMetric[];
  riskLevel?: string | null;
  completedSyncCount: number;
};

export type StartupAuditResult = {
  isVisible: boolean;
  lossMakingSkuCount: number;
  atRiskSkuCount: number;
  incompleteEconomicsCount: number;
  topReasons: string[];
  topActions: Array<{
    title: string;
    href: string;
    description: string;
  }>;
};

function buildReasonBuckets(metrics: Array<StartupAuditMetric>) {
  const buckets = new Map<string, { count: number; action: { title: string; href: string; description: string } }>();

  metrics.forEach((metric) => {
    const health = assessSkuHealth({
      contributionProfitRub: metric.contributionProfitRub,
      marginPct: metric.marginPct,
      soldUnits: metric.soldUnits,
      returnedUnits: metric.returnedUnits,
      hasIncompleteCosts: metric.hasIncompleteCosts
    });

    let key = "";
    let action = {
      title: "Проверить проблемные SKU",
      href: "/skus?profitability=attention",
      description: "Откройте список SKU, которые уже теряют деньги или могут быстро уйти в минус."
    };

    if (health.status === "incomplete") {
      key = "Не заполнены ручные затраты по части SKU";
      action = {
        title: "Заполнить неполную экономику",
        href: "/skus?profitability=incomplete",
        description: "Без себестоимости и ручных затрат прибыль может выглядеть лучше, чем есть на самом деле."
      };
    } else if (health.returnRate >= 0.12) {
      key = "Возвраты и обратная логистика заметно съедают маржу";
      action = {
        title: "Проверить SKU с возвратами",
        href: `/skus/${metric.skuId}`,
        description: `Начните с SKU «${metric.title}»: возвраты уже влияют на итоговую прибыль.`
      };
    } else if (metric.contributionProfitRub < 0) {
      key = "Цена уже не покрывает комиссию и логистику";
      action = {
        title: "Разобрать убыточные SKU",
        href: "/skus?profitability=loss",
        description: "Сначала проверьте цену, скидку и закупочную экономику у товаров, которые уже в минусе."
      };
    } else if (metric.marginPct < 0.15) {
      key = "Низкая маржа";
      action = {
        title: "Проверить SKU с хрупкой маржой",
        href: "/skus?profitability=attention",
        description: "Часть SKU пока в плюсе, но запас по цене и расходам уже почти исчез."
      };
    }

    if (!key) {
      return;
    }

    const current = buckets.get(key) ?? { count: 0, action };
    current.count += 1;
    buckets.set(key, current);
  });

  return [...buckets.entries()]
    .sort((left, right) => right[1].count - left[1].count)
    .slice(0, 3)
    .map(([reason, value]) => ({
      reason: `${reason} (${value.count})`,
      action: value.action
    }));
}

export function buildStartupAudit(input: StartupAuditInput): StartupAuditResult {
  const assessed = input.metrics.map((metric) => ({
    health: assessSkuHealth({
      contributionProfitRub: metric.contributionProfitRub,
      marginPct: metric.marginPct,
      soldUnits: metric.soldUnits,
      returnedUnits: metric.returnedUnits,
      hasIncompleteCosts: metric.hasIncompleteCosts
    })
  }));
  const reasonBuckets = buildReasonBuckets(input.metrics);

  if (input.riskLevel === "RISK") {
    reasonBuckets.unshift({
      reason: "Есть риск кассового разрыва на ближайшем горизонте",
      action: {
        title: "Проверить кассовый риск",
        href: "/cash-gap",
        description: "До запуска рекламы или закупки сверяйте ближайшие обязательства и выплаты."
      }
    });
  }

  return {
    isVisible: input.completedSyncCount <= 2,
    lossMakingSkuCount: assessed.filter((item) => item.health.status === "loss").length,
    atRiskSkuCount: assessed.filter((item) => item.health.status === "at_risk").length,
    incompleteEconomicsCount: assessed.filter((item) => item.health.status === "incomplete").length,
    topReasons: reasonBuckets.slice(0, 3).map((item) => item.reason),
    topActions: reasonBuckets.slice(0, 3).map((item) => item.action)
  };
}
