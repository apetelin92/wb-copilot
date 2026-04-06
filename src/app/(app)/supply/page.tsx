import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { getSupplyPlanningData, type SupplyAbcFilter, type SupplyStockMode, type SupplyUrgency } from "@/server/modules/supply/service";

export const dynamic = "force-dynamic";

const horizonOptions = [14, 21, 28];
const velocityOptions = [7, 14, 28];
const stockModeOptions: Array<{ value: SupplyStockMode; label: string }> = [
  { value: "lean", label: "Lean" },
  { value: "base", label: "Base" },
  { value: "safe", label: "Safe" }
];
const abcFilterOptions: SupplyAbcFilter[] = ["all", "A", "B", "C"];

function getUrgencyBadge(urgency: SupplyUrgency) {
  if (urgency === "critical") {
    return { value: "danger", label: "Срочно" };
  }

  if (urgency === "watch") {
    return { value: "warning", label: "Под контроль" };
  }

  if (urgency === "overstock") {
    return { value: "info", label: "Избыток" };
  }

  return { value: "success", label: "Норма" };
}

function getAbcBadge(abcClass: "A" | "B" | "C") {
  if (abcClass === "A") {
    return { value: "success", label: "A" };
  }

  if (abcClass === "B") {
    return { value: "warning", label: "B" };
  }

  return { value: "info", label: "C" };
}

function getStockModeDescription(stockMode: SupplyStockMode) {
  if (stockMode === "lean") {
    return "Оценка запаса с минимальным покрытием. Подходит для жёсткой кассовой дисциплины.";
  }

  if (stockMode === "safe") {
    return "Оценка запаса с более осторожным покрытием. Подходит, если важнее защититься от out-of-stock.";
  }

  return "Базовая оценка текущего покрытия. Компромисс между скоростью оборота и защитой от дефицита.";
}

export default async function SupplyPlanningPage({
  searchParams
}: {
  searchParams?: { horizonDays?: string; velocityWindowDays?: string; stockMode?: SupplyStockMode; abcFilter?: SupplyAbcFilter };
}) {
  const requestedHorizon = Number(searchParams?.horizonDays ?? "21");
  const requestedVelocityWindow = Number(searchParams?.velocityWindowDays ?? "14");
  const horizonDays = horizonOptions.includes(requestedHorizon) ? requestedHorizon : 21;
  const velocityWindowDays = velocityOptions.includes(requestedVelocityWindow) ? requestedVelocityWindow : 14;
  const stockMode = stockModeOptions.some((option) => option.value === searchParams?.stockMode) ? (searchParams?.stockMode as SupplyStockMode) : "base";
  const abcFilter = abcFilterOptions.includes((searchParams?.abcFilter as SupplyAbcFilter) ?? "all")
    ? ((searchParams?.abcFilter as SupplyAbcFilter) ?? "all")
    : "all";
  const data = await getSupplyPlanningData({ horizonDays, velocityWindowDays, stockMode, abcFilter });

  return (
    <main className="page">
      <PageHeader
        title="Планирование поставок"
        description="Дополнительный draft-модуль для приоритизации допоставок. Он не является главным ежедневным рабочим экраном продукта."
        actions={
          <div className="button-row">
            <Link className="button button--ghost" href="/abc-analysis">
              Открыть ABC
            </Link>
            <Link className="button button--secondary" href="/dashboard">
              Вернуться на сегодня
            </Link>
          </div>
        }
      />

      <section className="alert alert--warning">
        <strong>Дополнительный planning draft</strong>
        <p>Фактические складские остатки ещё не подключены. Этот экран полезен для приоритизации, но основной ежедневный путь продукта остаётся: `Сегодня` → `SKU` → `Касса`.</p>
      </section>

      <section className="panel panel--calm">
        <div className="analytics-controls">
          <div className="analytics-controls__row">
            <strong className="analytics-controls__label">Горизонт планирования</strong>
            <div className="pill-row analytics-controls__pills">
              {horizonOptions.map((value) => (
                <Link className={`pill ${horizonDays === value ? "pill--active" : ""}`} href={`/supply?horizonDays=${value}&velocityWindowDays=${velocityWindowDays}&stockMode=${stockMode}&abcFilter=${abcFilter}`} key={value}>
                  {value} дней
                </Link>
              ))}
            </div>
          </div>
          <div className="analytics-controls__row">
            <strong className="analytics-controls__label">Окно скорости продаж</strong>
            <div className="pill-row analytics-controls__pills">
              {velocityOptions.map((value) => (
                <Link className={`pill ${velocityWindowDays === value ? "pill--active" : ""}`} href={`/supply?horizonDays=${horizonDays}&velocityWindowDays=${value}&stockMode=${stockMode}&abcFilter=${abcFilter}`} key={value}>
                  {value} дней
                </Link>
              ))}
            </div>
          </div>
          <div className="analytics-controls__row">
            <strong className="analytics-controls__label">Режим оценки остатка</strong>
            <div className="pill-row analytics-controls__pills">
              {stockModeOptions.map((option) => (
                <Link className={`pill ${stockMode === option.value ? "pill--active" : ""}`} href={`/supply?horizonDays=${horizonDays}&velocityWindowDays=${velocityWindowDays}&stockMode=${option.value}&abcFilter=${abcFilter}`} key={option.value}>
                  {option.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="analytics-controls__row">
            <strong className="analytics-controls__label">ABC-срез</strong>
            <div className="pill-row analytics-controls__pills">
              {abcFilterOptions.map((value) => (
                <Link className={`pill ${abcFilter === value ? "pill--active" : ""}`} href={`/supply?horizonDays=${horizonDays}&velocityWindowDays=${velocityWindowDays}&stockMode=${stockMode}&abcFilter=${value}`} key={value}>
                  {value === "all" ? "Все SKU" : `Класс ${value}`}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <p className="muted">{getStockModeDescription(stockMode)}</p>
      </section>

      {data.items.length === 0 ? (
        <EmptyState
          title="Пока недостаточно данных для планирования поставок"
          description="Нужны продажи по SKU хотя бы за несколько дней, чтобы оценить скорость и покрытие."
          actionHref="/settings"
          actionLabel="Открыть настройки"
        />
      ) : (
        <>
          <section className="stats-grid stats-grid--secondary">
            <StatCard
              label="SKU в плане"
              value={String(data.summary.skuCount)}
              hint={abcFilter === "all" ? `Окно скорости: ${data.velocityWindowDays} дней` : `Показан только класс ${abcFilter}`}
            />
            <StatCard
              label="Срочно пополнить"
              tone={data.summary.criticalCount > 0 ? "danger" : "success"}
              value={String(data.summary.criticalCount)}
              hint="SKU с минимальным запасом покрытия"
            />
            <StatCard
              label="Под контролем"
              tone={data.summary.watchCount > 0 ? "warning" : "success"}
              value={String(data.summary.watchCount)}
              hint="Планирование нужно запустить заранее"
            />
            <StatCard
              label="Оценка допоставки"
              value={String(data.summary.recommendedReplenishmentUnits)}
              hint="Суммарный рекомендованный объём, шт"
            />
          </section>

          <section className="two-column">
            <article className="panel panel--calm">
              <h2>Как читать этот экран</h2>
              <ul className="info-list info-list--dense">
                <li>Сначала защищайте SKU класса A: потеря этих позиций бьет по портфелю сильнее всего.</li>
                <li>Смотрите не только на дефицит, но и на качество SKU: убыточный товар не стоит автоматически пополнять.</li>
                <li>Используйте экран для приоритета закупок, а не как финальный WMS-расчет.</li>
              </ul>
            </article>

            <article className="panel panel--muted">
              <h2>Что здесь оценочное</h2>
              <ul className="info-list info-list--dense">
                <li>Текущий запас пока не приходит со склада и рассчитывается эвристически.</li>
                <li>Рекомендация по допоставке опирается на текущий темп продаж и целевое покрытие по классу SKU.</li>
                <li>После подключения фактических остатков этот модуль можно перевести из draft в рабочий контур.</li>
              </ul>
            </article>
          </section>

          <section className="table-card">
            <div className="meta-row">
              <h2>Приоритеты допоставки</h2>
              <span className="muted">Горизонт: {data.horizonDays} дней · запуск считается так, чтобы товар не лежал лишние дни</span>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>ABC</th>
                    <th>Скорость / день</th>
                    <th>Оценка остатка</th>
                    <th>До дефицита</th>
                    <th>Запустить до</th>
                    <th>Приход</th>
                    <th>Цель покрытия</th>
                    <th>Допоставка</th>
                    <th>Приоритет</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const urgencyBadge = getUrgencyBadge(item.urgency);
                    const abcBadge = getAbcBadge(item.abcClass);

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
                        <td>
                          <StatusBadge value={abcBadge.value} label={abcBadge.label} />
                        </td>
                        <td>{item.dailySalesVelocity.toFixed(1)}</td>
                        <td>{item.estimatedStockUnits} шт</td>
                        <td>{item.daysToZero.toFixed(1)}</td>
                        <td>{item.urgency === "overstock" ? "Не сейчас" : item.launchInDays === 0 ? "Сегодня" : formatDate(item.launchDate)}</td>
                        <td>{item.urgency === "overstock" ? "Позже" : formatDate(item.arrivalDate)}</td>
                        <td>{item.targetCoverageDays} дн.</td>
                        <td>{item.recommendedReplenishmentUnits} шт</td>
                        <td>
                          <StatusBadge value={urgencyBadge.value} label={urgencyBadge.label} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="analytics-grid-3">
            <article className="panel panel--calm">
              <h2>Пополнить в первую очередь</h2>
              <ul className="info-list info-list--dense">
                {data.highlights.replenishFirst.length === 0 ? (
                  <li>Срочных кандидатов на пополнение не видно.</li>
                ) : (
                  data.highlights.replenishFirst.map((item) => (
                    <li key={item.skuId}>
                      <Link className="table-sku-link table-sku-link--inline" href={`/skus/${item.skuId}`}>
                        <span className="table-sku-link__title">{item.title}</span>
                      </Link>{" "}
                      · до {formatDate(item.launchDate)} · {item.recommendedReplenishmentUnits} шт
                    </li>
                  ))
                )}
              </ul>
            </article>

            <article className="panel panel--calm">
              <h2>Класс A под защитой</h2>
              <p>
                В текущем срезе под особым контролем {data.summary.protectedAItems} SKU класса A. Для них out-of-stock опаснее, чем для хвоста ассортимента.
              </p>
            </article>

            <article className="panel panel--calm">
              <h2>Проверь избыток</h2>
              <ul className="info-list info-list--dense">
                {data.highlights.overstockTail.length === 0 ? (
                  <li>Явного избытка по оценочному покрытию не видно.</li>
                ) : (
                  data.highlights.overstockTail.map((item) => (
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
