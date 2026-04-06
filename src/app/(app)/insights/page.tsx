import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { listInsightsFeed } from "@/server/modules/insights/service";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

type InsightSectionKey = "important" | "sku" | "cash-gap" | "briefs" | "system" | "all";

const sections: Array<{ value: InsightSectionKey; label: string }> = [
  { value: "important", label: "Важное" },
  { value: "sku", label: "SKU" },
  { value: "cash-gap", label: "Касса" },
  { value: "briefs", label: "Брифы" },
  { value: "system", label: "Система" },
  { value: "all", label: "Все" }
];

function getInsightSection(insight: Awaited<ReturnType<typeof listInsightsFeed>>[number]): InsightSectionKey {
  if (insight.status === "FAILED" || insight.status === "FALLBACK") {
    return "system";
  }

  if (insight.kind === "CASH_GAP") {
    return "cash-gap";
  }

  if (insight.kind === "DAILY_BRIEF") {
    return "briefs";
  }

  return "sku";
}

function isImportant(insight: Awaited<ReturnType<typeof listInsightsFeed>>[number]) {
  return insight.kind === "CASH_GAP" || insight.kind === "DAILY_BRIEF" || insight.status === "FAILED";
}

function getSectionTitle(section: InsightSectionKey) {
  switch (section) {
    case "important":
      return "Главное";
    case "sku":
      return "По SKU";
    case "cash-gap":
      return "По кассе";
    case "briefs":
      return "Ежедневные брифы";
    case "system":
      return "Система и fallback";
    default:
      return "Все инсайты";
  }
}

export default async function InsightsPage({ searchParams }: { searchParams?: { section?: InsightSectionKey } }) {
  const section = searchParams?.section ?? "important";
  const insights = await listInsightsFeed();
  const grouped = {
    important: insights.filter(isImportant),
    sku: insights.filter((item) => getInsightSection(item) === "sku"),
    "cash-gap": insights.filter((item) => getInsightSection(item) === "cash-gap"),
    briefs: insights.filter((item) => getInsightSection(item) === "briefs"),
    system: insights.filter((item) => getInsightSection(item) === "system"),
    all: insights
  } satisfies Record<InsightSectionKey, typeof insights>;
  const activeInsights = grouped[section];

  return (
    <main className="page">
      <PageHeader title="Что изменилось и где нужен разбор" description="Лента сгруппирована по важности, чтобы сначала видеть решения и риски, а не просто журнал событий." />

      <section className="panel panel--calm">
        <div className="pill-row">
          {sections.map((item) => (
            <Link className={`pill ${section === item.value ? "pill--active" : ""}`} href={`/insights?section=${item.value}`} key={item.value}>
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      {activeInsights.length === 0 ? (
        <EmptyState
          title="В этом разделе пока пусто"
          description="После следующей синхронизации здесь появятся новые объяснения и сигналы для работы." 
          actionHref="/dashboard"
          actionLabel="Вернуться на дашборд"
        />
      ) : (
        <section className="feed-section">
          <div className="meta-row">
            <h2>{getSectionTitle(section)}</h2>
            <StatusBadge value="info" label={`${activeInsights.length} записей`} />
          </div>
          <div className="feed-list feed-list--prioritized">
            {activeInsights.map((insight) => (
              <article className={`feed-item ${isImportant(insight) ? "feed-item--important" : ""}`} key={insight.id}>
                <div className="feed-item__meta">
                  <StatusBadge value={insight.kind} />
                  <StatusBadge value={insight.status} />
                  <span className="muted">{formatDateTime(insight.createdAt)}</span>
                  {insight.skuTitle ? <Link href="/skus?profitability=attention">{insight.skuTitle}</Link> : null}
                </div>
                <h3>{insight.title}</h3>
                <p>{insight.content}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
