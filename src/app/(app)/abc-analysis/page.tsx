import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { formatCurrency, formatPercent } from "@/lib/format";
import { getAbcAnalysis, type AbcBasis } from "@/server/modules/abc/service";

export const dynamic = "force-dynamic";

const focusClassOptions = ["A", "B", "C"] as const;

const basisOptions: Array<{ value: AbcBasis; label: string }> = [
  { value: "profit", label: "По прибыли" },
  { value: "revenue", label: "По выручке" }
];

const periodOptions = [30, 90];
const sortOptions = ["basis", "profit_desc", "revenue_desc", "margin_asc", "margin_desc"] as const;

type AbcSort = (typeof sortOptions)[number];

function getBasisLabel(value: AbcBasis) {
  return value === "profit" ? "прибыли" : "выручки";
}

function getBadgeTone(value: "A" | "B" | "C") {
  if (value === "A") {
    return "success";
  }

  if (value === "B") {
    return "warning";
  }

  return "info";
}

export default async function AbcAnalysisPage({
  searchParams
}: {
  searchParams?: { basis?: AbcBasis; periodDays?: string; focusClass?: string; sort?: string; q?: string };
}) {
  const basis = searchParams?.basis === "revenue" ? "revenue" : "profit";
  const requestedPeriod = Number(searchParams?.periodDays ?? "30");
  const periodDays = periodOptions.includes(requestedPeriod) ? requestedPeriod : 30;
  const focusClass = focusClassOptions.includes(searchParams?.focusClass as (typeof focusClassOptions)[number])
    ? (searchParams?.focusClass as "A" | "B" | "C")
    : null;
  const sort = sortOptions.includes(searchParams?.sort as AbcSort) ? (searchParams?.sort as AbcSort) : "basis";
  const query = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const data = await getAbcAnalysis({ basis, periodDays });
  const visibleItems = data.items
    .filter((item) => {
      const searchTarget = `${item.title} ${item.brand ?? ""} ${item.subject ?? ""} ${item.wbNmId}`.toLowerCase();

      if (query && !searchTarget.includes(query.toLowerCase())) {
        return false;
      }

      if (!focusClass) {
        return true;
      }

      return (basis === "profit" ? item.profitAbcClass : item.revenueAbcClass) === focusClass;
    })
    .sort((left, right) => {
      if (sort === "profit_desc") {
        return right.contributionProfitRub - left.contributionProfitRub;
      }

      if (sort === "revenue_desc") {
        return right.netRevenueRub - left.netRevenueRub;
      }

      if (sort === "margin_asc") {
        return left.marginPct - right.marginPct || right.netRevenueRub - left.netRevenueRub;
      }

      if (sort === "margin_desc") {
        return right.marginPct - left.marginPct || right.contributionProfitRub - left.contributionProfitRub;
      }

      const leftValue = basis === "profit" ? left.contributionProfitRub : left.netRevenueRub;
      const rightValue = basis === "profit" ? right.contributionProfitRub : right.netRevenueRub;

      return rightValue - leftValue;
    });

  return (
    <main className="page">
      <PageHeader
        title="ABC Analysis"
        description="Дополнительный модуль: помогает приоритизировать ассортимент, но не заменяет ежедневный сценарий Today → SKU → Cash."
        actions={
          <div className="button-row">
            <Link className="button button--ghost" href="/skus">
              Открыть SKU
            </Link>
            <Link className="button button--secondary" href="/dashboard">
              Вернуться на сегодня
            </Link>
          </div>
        }
      />

      <section className="alert alert--warning">
        <strong>Дополнительный модуль</strong>
        <p>Используйте ABC для расширенного разбора портфеля. Основная ежедневная работа по MarginPoint проходит через `Сегодня`, `SKU` и `Кассу`.</p>
      </section>

      <section className="panel panel--calm">
        <div className="analytics-controls">
          <div className="analytics-controls__row">
            <strong className="analytics-controls__label">Основа анализа</strong>
            <div className="pill-row analytics-controls__pills">
              {basisOptions.map((option) => (
                <Link className={`pill ${basis === option.value ? "pill--active" : ""}`} href={`/abc-analysis?basis=${option.value}&periodDays=${periodDays}`} key={option.value}>
                  {option.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="analytics-controls__row">
            <strong className="analytics-controls__label">Период</strong>
            <div className="pill-row analytics-controls__pills">
              {periodOptions.map((value) => (
                <Link className={`pill ${periodDays === value ? "pill--active" : ""}`} href={`/abc-analysis?basis=${basis}&periodDays=${value}`} key={value}>
                  {value} дней
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {data.items.length === 0 ? (
        <EmptyState
          title="Пока недостаточно данных для ABC-анализа"
          description="Сначала выполните синхронизацию и накопите продажи по SKU хотя бы за несколько дней."
          actionHref="/settings"
          actionLabel="Открыть настройки"
        />
      ) : (
        <>
          <section className="stats-grid stats-grid--secondary">
            <StatCard
              label="SKU в анализе"
              value={String(data.summary.skuCount)}
              hint={`Срез за ${data.periodDays} дней`}
            />
            <StatCard
              label="Доля класса A"
              tone={data.summary.aClassShare >= 0.75 ? "success" : "warning"}
              value={formatPercent(data.summary.aClassShare)}
              hint={`Сколько ${getBasisLabel(data.basis)} дает класс A`}
            />
            <StatCard
              label="Суммарная выручка"
              value={formatCurrency(data.summary.totalRevenueRub)}
              hint="По всем SKU в периоде"
            />
            <StatCard
              label="Вклад в прибыль"
              tone={data.summary.totalContributionProfitRub >= 0 ? "success" : "danger"}
              value={formatCurrency(data.summary.totalContributionProfitRub)}
              hint="Суммарный результат портфеля"
            />
          </section>

          <section className="analytics-grid-3">
            <Link className={`panel panel--calm summary-link-card ${focusClass === "A" ? "summary-link-card--active" : ""}`} href={`/abc-analysis?basis=${basis}&periodDays=${periodDays}&focusClass=A`}>
              <div className="meta-row">
                <h2>Класс A</h2>
                <StatusBadge value={getBadgeTone("A")} label={String(data.summary.classCounts.A)} />
              </div>
              <p>Ключевые SKU, которые формируют основной результат. Их нужно защищать по цене, наличию и марже.</p>
            </Link>
            <Link className={`panel panel--calm summary-link-card ${focusClass === "B" ? "summary-link-card--active" : ""}`} href={`/abc-analysis?basis=${basis}&periodDays=${periodDays}&focusClass=B`}>
              <div className="meta-row">
                <h2>Класс B</h2>
                <StatusBadge value={getBadgeTone("B")} label={String(data.summary.classCounts.B)} />
              </div>
              <p>Средний слой ассортимента. Здесь обычно находятся кандидаты на рост или оптимизацию.</p>
            </Link>
            <Link className={`panel panel--calm summary-link-card ${focusClass === "C" ? "summary-link-card--active" : ""}`} href={`/abc-analysis?basis=${basis}&periodDays=${periodDays}&focusClass=C`}>
              <div className="meta-row">
                <h2>Класс C</h2>
                <StatusBadge value={getBadgeTone("C")} label={String(data.summary.classCounts.C)} />
              </div>
              <p>SKU с минимальным вкладом в выбранную базу анализа. Их стоит упрощать, чистить или держать под контролем.</p>
            </Link>
          </section>

          <section className="two-column">
            <article className="panel panel--calm">
              <h2>Что делать с этим срезом</h2>
              <ul className="info-list info-list--dense">
                <li>Сначала защитите класс A: остатки, цена, маржа и реклама не должны ломать ядро портфеля.</li>
                <li>Затем разберите класс B: что можно дотянуть до A, а что не стоит масштабировать.</li>
                <li>По классу C уберите лишнее внимание и проверьте, не съедают ли эти SKU операционный ресурс.</li>
              </ul>
            </article>

            <article className="panel panel--muted">
              <h2>Как читать ABC в MarginPoint</h2>
              <ul className="info-list info-list--dense">
                <li>`По прибыли` лучше для управленческих решений: показывает, где реально создается результат.</li>
                <li>`По выручке` полезен как дополнительный слой: показывает концентрацию оборота.</li>
                <li>Если SKU крупный по выручке, но слабый по прибыли, это прямой кандидат на разбор юнит-экономики.</li>
              </ul>
            </article>
          </section>

          <section className="table-card">
            <div className="meta-row">
              <h2>Срез по SKU</h2>
              <span className="muted">{visibleItems.length} SKU в текущем окне</span>
            </div>
            <div className="analytics-slice-toolbar">
              <div className="analytics-slice-toolbar__filters">
                <strong className="analytics-slice-toolbar__title">Класс</strong>
                <div className="pill-row">
                  <Link className={`pill ${focusClass === null ? "pill--active" : ""}`} href={`/abc-analysis?basis=${basis}&periodDays=${periodDays}&sort=${sort}${query ? `&q=${encodeURIComponent(query)}` : ""}`}>
                    Все SKU
                  </Link>
                  {focusClassOptions.map((value) => (
                    <Link
                      className={`pill ${focusClass === value ? "pill--active" : ""}`}
                      href={`/abc-analysis?basis=${basis}&periodDays=${periodDays}&focusClass=${value}&sort=${sort}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
                      key={value}
                    >
                      Класс {value}
                    </Link>
                  ))}
                </div>
              </div>
              <form className="analytics-slice-toolbar__form" method="get">
                <input name="basis" type="hidden" value={basis} />
                <input name="periodDays" type="hidden" value={String(periodDays)} />
                {focusClass ? <input name="focusClass" type="hidden" value={focusClass} /> : null}
                <div className="field">
                  <label htmlFor="abc-q">Поиск по SKU</label>
                  <input defaultValue={query} id="abc-q" name="q" placeholder="Название, бренд или WB nmID" type="search" />
                </div>
                <div className="field">
                  <label htmlFor="abc-sort">Сортировка</label>
                  <select defaultValue={sort} id="abc-sort" name="sort">
                    <option value="basis">По текущей основе анализа</option>
                    <option value="profit_desc">Сильные по прибыли</option>
                    <option value="revenue_desc">Сильные по выручке</option>
                    <option value="margin_asc">Слабая маржа сверху</option>
                    <option value="margin_desc">Сильная маржа сверху</option>
                  </select>
                </div>
                <button className="button button--secondary" type="submit">
                  Применить
                </button>
                {query || sort !== "basis" || focusClass ? (
                  <Link className="button button--ghost" href={`/abc-analysis?basis=${basis}&periodDays=${periodDays}`}>
                    Сбросить
                  </Link>
                ) : null}
              </form>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Выручка</th>
                    <th>Прибыль</th>
                    <th>Маржа</th>
                    <th>ABC выручка</th>
                    <th>ABC прибыль</th>
                    <th>Накопленная доля</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => {
                    const selectedCumulativeShare = data.basis === "profit" ? item.profitCumulativeShare : item.revenueCumulativeShare;

                    return (
                      <tr key={item.skuId}>
                        <td>
                          <Link className="table-sku-link" href={`/skus/${item.skuId}`}>
                            <span className="table-sku-link__title">{item.title}</span>
                            <span className="table-sku-link__meta">
                              WB {item.wbNmId}
                              {item.brand ? ` · ${item.brand}` : ""}
                            </span>
                          </Link>
                        </td>
                        <td>{formatCurrency(item.netRevenueRub)}</td>
                        <td className={item.contributionProfitRub >= 0 ? "text-success" : "text-danger"}>{formatCurrency(item.contributionProfitRub)}</td>
                        <td>{formatPercent(item.marginPct)}</td>
                        <td>
                          <StatusBadge value={getBadgeTone(item.revenueAbcClass)} label={item.revenueAbcClass} />
                        </td>
                        <td>
                          <StatusBadge value={getBadgeTone(item.profitAbcClass)} label={item.profitAbcClass} />
                        </td>
                        <td>{formatPercent(selectedCumulativeShare)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {focusClass || query || sort !== "basis" ? (
              <div className="summary-inline-meta">
                <Link className="summary-inline-item" href={`/abc-analysis?basis=${basis}&periodDays=${periodDays}`}>
                  <span>Срез</span>
                  <strong>Вернуться к полному списку</strong>
                </Link>
              </div>
            ) : null}
          </section>

          <section className="analytics-grid-3">
            <article className="panel panel--calm">
              <h2>Топ A SKU</h2>
              <ul className="info-list info-list--dense">
                {data.highlights.topAItems.length === 0 ? (
                  <li>Нет выраженного класса A.</li>
                ) : (
                  data.highlights.topAItems.map((item) => (
                    <li key={item.skuId}>
                      <Link className="table-sku-link table-sku-link--inline" href={`/skus/${item.skuId}`}>
                        <span className="table-sku-link__title">{item.title}</span>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </article>
            <article className="panel panel--calm">
              <h2>Слабые B SKU</h2>
              <ul className="info-list info-list--dense">
                {data.highlights.weakBItems.length === 0 ? (
                  <li>У класса B нет явных кандидатов на разбор.</li>
                ) : (
                  data.highlights.weakBItems.map((item) => (
                    <li key={item.skuId}>
                      <Link className="table-sku-link table-sku-link--inline" href={`/skus/${item.skuId}`}>
                        <span className="table-sku-link__title">{item.title}</span>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </article>
            <article className="panel panel--calm">
              <h2>Хвост C SKU</h2>
              <ul className="info-list info-list--dense">
                {data.highlights.lowValueCItems.length === 0 ? (
                  <li>Класс C пока не выражен.</li>
                ) : (
                  data.highlights.lowValueCItems.map((item) => (
                    <li key={item.skuId}>
                      <Link className="table-sku-link table-sku-link--inline" href={`/skus/${item.skuId}`}>
                        <span className="table-sku-link__title">{item.title}</span>
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </article>
          </section>
        </>
      )}
    </main>
  );
}
