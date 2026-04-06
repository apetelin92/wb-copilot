import OpenAI from "openai";
import { BriefStatus, InsightKind, InsightStatus } from "@prisma/client";

import { env } from "@/server/lib/env";
import { prisma } from "@/server/lib/prisma";
import { toNumber } from "@/server/lib/number";
import { resolveOrganizationContext } from "@/server/modules/workspace/context";

const PROMPT_VERSION = "2026-03-26-mvp-v1";

type BriefPayload = {
  headline: string;
  summary: string;
  positives: string[];
  risks: string[];
  actions: string[];
};

function getOpenAiClient() {
  if (!env.openAiApiKey) {
    return null;
  }

  return new OpenAI({ apiKey: env.openAiApiKey });
}

function buildFallbackBrief(params: {
  metricDate: Date;
  totalContributionRub: number;
  profitableSkuCount: number;
  lossMakingSkuCount: number;
  incompleteEconomicsCount: number;
  topSkuTitles: string[];
  worstSkuTitles: string[];
  riskSummary: string;
}): BriefPayload {
  return {
    headline: `Вклад в прибыль составляет ${params.totalContributionRub.toFixed(2)} ₽ на ${params.metricDate.toISOString().slice(0, 10)}.`,
    summary: `Прибыльных SKU: ${params.profitableSkuCount}. Убыточных SKU: ${params.lossMakingSkuCount}. SKU с неполной экономикой: ${params.incompleteEconomicsCount}. ${params.riskSummary}`,
    positives: params.topSkuTitles.length > 0 ? [`Лучший вклад в прибыль дают: ${params.topSkuTitles.join(", ")}.`] : [],
    risks: [
      ...(params.worstSkuTitles.length > 0 ? [`Основной риск сосредоточен в SKU: ${params.worstSkuTitles.join(", ")}.`] : []),
      ...(params.incompleteEconomicsCount > 0 ? [`Есть ${params.incompleteEconomicsCount} SKU, где экономика ещё неполная.`] : [params.riskSummary])
    ].slice(0, 2),
    actions: [
      "Разберите SKU с отрицательным вкладом в прибыль.",
      "Проверьте себестоимость и затраты у SKU с неполной экономикой.",
      "Сверьте ближайшие выплаты WB с предстоящими обязательствами."
    ]
  };
}

async function createAiBrief(payload: Record<string, unknown>): Promise<BriefPayload | null> {
  const client = getOpenAiClient();
  if (!client) {
    return null;
  }

  const response = await client.chat.completions.create({
    model: env.openAiModel,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You write concise finance copilot briefs for marketplace sellers. Return strict JSON with headline, summary, positives, risks, actions. No markdown."
      },
      {
        role: "user",
        content: JSON.stringify(payload)
      }
    ]
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return null;
  }

  return JSON.parse(content) as BriefPayload;
}

async function createAiText(payload: Record<string, unknown>): Promise<string | null> {
  const client = getOpenAiClient();
  if (!client) {
    return null;
  }

  const response = await client.chat.completions.create({
    model: env.openAiModel,
    messages: [
      {
        role: "system",
        content:
          "Explain SKU or cash-gap performance using only the provided metrics. Keep the explanation under 120 words, concrete, and operational."
      },
      {
        role: "user",
        content: JSON.stringify(payload)
      }
    ]
  });

  return response.choices[0]?.message?.content ?? null;
}

export async function generateDailyBrief(input: { organizationId: string; syncRunId: string; asOfDate: Date; riskSummary: string }) {
  const [accountMetric, topSkus, worstSkus, incompleteEconomicsCount] = await Promise.all([
    prisma.dailyAccountMetric.findUnique({
      where: {
        organizationId_metricDate: {
          organizationId: input.organizationId,
          metricDate: input.asOfDate
        }
      }
    }),
    prisma.dailySkuMetric.findMany({
      where: {
        organizationId: input.organizationId,
        metricDate: input.asOfDate
      },
      include: { sku: true },
      orderBy: { contributionProfitRub: "desc" },
      take: 3
    }),
    prisma.dailySkuMetric.findMany({
      where: {
        organizationId: input.organizationId,
        metricDate: input.asOfDate
      },
      include: { sku: true },
      orderBy: { contributionProfitRub: "asc" },
      take: 3
    }),
    prisma.dailySkuMetric.count({
      where: {
        organizationId: input.organizationId,
        metricDate: input.asOfDate,
        hasIncompleteCosts: true
      }
    })
  ]);

  if (!accountMetric) {
    return null;
  }

  const aiPayload = {
    metricDate: input.asOfDate.toISOString().slice(0, 10),
    totalContributionRub: toNumber(accountMetric.totalContributionRub),
    profitableSkuCount: accountMetric.profitableSkuCount,
    lossMakingSkuCount: accountMetric.lossMakingSkuCount,
    incompleteEconomicsCount,
    topSkus: topSkus.map((item) => ({ title: item.sku.title, contributionProfitRub: toNumber(item.contributionProfitRub) })),
    worstSkus: worstSkus.map((item) => ({ title: item.sku.title, contributionProfitRub: toNumber(item.contributionProfitRub) })),
    riskSummary: input.riskSummary
  };

  let brief = buildFallbackBrief({
    metricDate: input.asOfDate,
    totalContributionRub: toNumber(accountMetric.totalContributionRub),
    profitableSkuCount: accountMetric.profitableSkuCount,
    lossMakingSkuCount: accountMetric.lossMakingSkuCount,
    incompleteEconomicsCount,
    topSkuTitles: topSkus.map((item) => item.sku.title),
    worstSkuTitles: worstSkus.map((item) => item.sku.title),
    riskSummary: input.riskSummary
  });
  let status: InsightStatus = InsightStatus.FALLBACK;

  try {
    const aiBrief = await createAiBrief(aiPayload);
    if (aiBrief) {
      brief = aiBrief;
      status = InsightStatus.GENERATED;
    }
  } catch (error) {
    console.error("Failed to generate AI daily brief", error);
  }

  const dailyBrief = await prisma.dailyBrief.upsert({
    where: {
      organizationId_briefDate: {
        organizationId: input.organizationId,
        briefDate: input.asOfDate
      }
    },
    update: {
      syncRunId: input.syncRunId,
      status: BriefStatus.GENERATED,
      headline: brief.headline,
      summary: brief.summary,
      payload: brief
    },
    create: {
      organizationId: input.organizationId,
      syncRunId: input.syncRunId,
      briefDate: input.asOfDate,
      status: BriefStatus.GENERATED,
      headline: brief.headline,
      summary: brief.summary,
      payload: brief
    }
  });

  await prisma.aIInsight.create({
    data: {
      organizationId: input.organizationId,
      syncRunId: input.syncRunId,
      insightDate: input.asOfDate,
      kind: InsightKind.DAILY_BRIEF,
      status,
      title: brief.headline,
      content: brief.summary,
      modelName: status === InsightStatus.GENERATED ? env.openAiModel : null,
      promptVersion: PROMPT_VERSION,
      metadata: brief
    }
  });

  return dailyBrief;
}

export async function ensureSkuInsight(input: { organizationId: string; skuId: string; asOfDate: Date; syncRunId?: string | null }) {
  const existing = await prisma.aIInsight.findFirst({
    where: {
      organizationId: input.organizationId,
      skuId: input.skuId,
      insightDate: input.asOfDate,
      kind: InsightKind.SKU_EXPLANATION
    },
    orderBy: { createdAt: "desc" }
  });

  if (existing) {
    return existing;
  }

  const metric = await prisma.dailySkuMetric.findUnique({
    where: {
      organizationId_skuId_metricDate: {
        organizationId: input.organizationId,
        skuId: input.skuId,
        metricDate: input.asOfDate
      }
    },
    include: {
      sku: true
    }
  });

  if (!metric) {
    return null;
  }

  const previousMetric = await prisma.dailySkuMetric.findFirst({
    where: {
      organizationId: input.organizationId,
      skuId: input.skuId,
      metricDate: {
        lt: input.asOfDate
      }
    },
    orderBy: { metricDate: "desc" }
  });

  const fallback = `${metric.sku.title} дал ${toNumber(metric.contributionProfitRub).toFixed(2)} ₽ вклада в прибыль на ${input.asOfDate.toISOString().slice(0, 10)} при марже ${(toNumber(metric.marginPct) * 100).toFixed(1)}%. Чистая выручка составила ${toNumber(metric.netRevenueRub).toFixed(2)} ₽, а комиссия и логистика заняли ${(toNumber(metric.logisticsRub) + toNumber(metric.commissionRub)).toFixed(2)} ₽${metric.hasIncompleteCosts ? ", при этом часть затрат ещё не подтверждена" : ""}.`;
  let content = fallback;
  let status: InsightStatus = InsightStatus.FALLBACK;

  try {
    const aiText = await createAiText({
      sku: metric.sku.title,
      asOfDate: input.asOfDate.toISOString().slice(0, 10),
      netRevenueRub: toNumber(metric.netRevenueRub),
      contributionProfitRub: toNumber(metric.contributionProfitRub),
      marginPct: toNumber(metric.marginPct),
      logisticsRub: toNumber(metric.logisticsRub),
      commissionRub: toNumber(metric.commissionRub),
      returnCostRub: toNumber(metric.returnCostRub),
      incompleteCosts: metric.hasIncompleteCosts,
      previousContributionProfitRub: previousMetric ? toNumber(previousMetric.contributionProfitRub) : null
    });

    if (aiText) {
      content = aiText;
      status = InsightStatus.GENERATED;
    }
  } catch (error) {
    console.error("Не удалось сгенерировать AI-объяснение по SKU", error);
  }

  return prisma.aIInsight.create({
    data: {
      organizationId: input.organizationId,
      syncRunId: input.syncRunId ?? undefined,
      skuId: input.skuId,
      insightDate: input.asOfDate,
      kind: InsightKind.SKU_EXPLANATION,
      status,
      title: `Разбор SKU: ${metric.sku.title}`,
      content,
      modelName: status === InsightStatus.GENERATED ? env.openAiModel : null,
      promptVersion: PROMPT_VERSION,
      metadata: {
        metricId: metric.id,
        previousMetricId: previousMetric?.id ?? null
      }
    }
  });
}

export async function upsertCashGapInsight(input: { organizationId: string; syncRunId?: string | null; asOfDate: Date; riskLevel: string; explanation: string }) {
  await prisma.aIInsight.create({
    data: {
      organizationId: input.organizationId,
      syncRunId: input.syncRunId ?? undefined,
      insightDate: input.asOfDate,
      kind: InsightKind.CASH_GAP,
      status: InsightStatus.FALLBACK,
      title: `Кассовый риск: ${input.riskLevel.toLowerCase()}`,
      content: input.explanation,
      promptVersion: PROMPT_VERSION
    }
  });
}

export async function listInsightsFeed(input?: { limit?: number; organizationId?: string }) {
  const organization = await resolveOrganizationContext({ organizationId: input?.organizationId });

  const insights = await prisma.aIInsight.findMany({
    where: { organizationId: organization.id },
    include: {
      sku: true
    },
    orderBy: [{ insightDate: "desc" }, { createdAt: "desc" }],
    take: input?.limit ?? 30
  });

  return insights.map((insight) => ({
    id: insight.id,
    insightDate: insight.insightDate,
    kind: insight.kind,
    status: insight.status,
    title: insight.title,
    content: insight.content,
    skuTitle: insight.sku?.title ?? null,
    createdAt: insight.createdAt
  }));
}
