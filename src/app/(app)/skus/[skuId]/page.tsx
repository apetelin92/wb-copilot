import Link from "next/link";
import { notFound } from "next/navigation";

import { saveCostProfileAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { StatusSummaryBlock } from "@/components/status-summary-block";
import { SubmitButton } from "@/components/submit-button";
import { encodeUnitEconomicsDraft } from "@/lib/unit-economics/share";
import { AppError } from "@/server/lib/errors";
import { getSkuDetail } from "@/server/modules/sku/service";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";

export const dynamic = "force-dynamic";

function getTone(status?: string | null) {
  if (status === "loss") {
    return "danger" as const;
  }

  if (status === "incomplete" || status === "at_risk") {
    return "warning" as const;
  }

  return "success" as const;
}

function getDecisionTitle(status?: string | null) {
  if (status === "loss") {
    return "SKU теряет прибыль и требует решения сегодня";
  }

  if (status === "incomplete") {
    return "По SKU нельзя доверять прибыли без полной экономики";
  }

  if (status === "at_risk") {
    return "SKU ещё в плюсе, но запас по марже почти исчерпан";
  }

  return "SKU выглядит устойчиво";
}

export default async function SkuDetailPage({ params }: { params: { skuId: string } }) {
  let data;

  try {
    data = await getSkuDetail(params.skuId);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 404) {
      notFound();
    }

    throw error;
  }

  const tone = getTone(data.decisionSupport?.status ?? null);
  const calculatorHref = data.calculatorPreview ? `/calculator?draft=${encodeURIComponent(encodeUnitEconomicsDraft(data.calculatorPreview.input))}` : "/calculator";
  const decisionSupport = data.decisionSupport;
  const cashHref = "/cash-gap";

  return (
    <main className="page">
      <PageHeader
        badges={
          <>
            {decisionSupport ? <StatusBadge label={decisionSupport.statusLabel} value={tone} /> : null}
            {data.incompleteEconomics ? <StatusBadge label="Нужны затраты" value="warning" /> : null}
          </>
        }
        meta={
          data.metric ? (
            <>
              <span className="meta-chip">Вклад в прибыль: {formatCurrency(data.metric.contributionProfitRub)}</span>
              <span className="meta-chip">Маржа: {formatPercent(data.metric.marginPct)}</span>
              <span className="meta-chip">Выручка: {formatCurrency(data.metric.netRevenueRub)}</span>
            </>
          ) : undefined
        }
        title={data.sku.title}
        description={`WB NM ID: ${data.sku.wbNmId}${data.sku.vendorCode ? ` · ${data.sku.vendorCode}` : ""} · сначала примите решение по SKU, затем проверьте кассовый эффект.`}
        actions={
          <div className="button-row">
            <Link className="button button--primary" href={cashHref}>
              Открыть кассу
            </Link>
            <Link className="button button--secondary" href={calculatorHref}>
              Проверить сценарий
            </Link>
            <Link className="button button--ghost" href="/skus?profitability=attention">
              Назад к SKU
            </Link>
          </div>
        }
      />

      {decisionSupport ? (
        <StatusSummaryBlock
          action={decisionSupport.action}
          actionLabel="Что делать сейчас"
          badgeLabel={decisionSupport.statusLabel}
          meta={[
            { label: "Вклад в прибыль", value: data.metric ? formatCurrency(data.metric.contributionProfitRub) : "—" },
            { label: "Маржа", value: data.metric ? formatPercent(data.metric.marginPct) : "—" },
            { label: "Выручка", value: data.metric ? formatCurrency(data.metric.netRevenueRub) : "—" }
          ]}
          reason={decisionSupport.reason}
          reasonLabel="Почему это важно"
          title={getDecisionTitle(decisionSupport.status)}
          tone={tone}
        />
      ) : null}

      {decisionSupport ? (
        <section className="panel panel--calm section-stack">
          <div className="section-heading">
            <h2>Что видно по SKU</h2>
            <p className="muted">{decisionSupport.whatHappened}</p>
          </div>
          <div className="summary-inline-meta">
            <article className="summary-inline-item">
              <span>Следующий шаг</span>
              <strong>{decisionSupport.whatToDo}</strong>
            </article>
            <Link className="summary-inline-item" href={cashHref}>
              <span>Денежное последствие</span>
              <strong>Открыть кассу</strong>
            </Link>
            <Link className="summary-inline-item" href={calculatorHref}>
              <span>Если нужен сценарий</span>
              <strong>Проверить в калькуляторе</strong>
            </Link>
          </div>
        </section>
      ) : null}

      {data.incompleteEconomics ? (
        <details className="panel panel--muted section-stack details-card" open>
          <summary className="details-card__summary">
            <div>
              <strong>Неполная экономика</strong>
              <p className="muted">Сначала закройте missing fields, потом возвращайтесь к цене и рекламе.</p>
            </div>
            <StatusBadge label={`${data.incompleteEconomics.missingFields.length} полей`} value="warning" />
          </summary>
          <p>{data.incompleteEconomics.summary}</p>
          <ul className="info-list info-list--dense">
            {data.incompleteEconomics.missingFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {data.calculatorPreview ? (
        <details className="panel panel--calm section-stack details-card">
          <summary className="details-card__summary">
            <div>
              <strong>Проверить решение в калькуляторе</strong>
              <p className="muted">Вторичный шаг: открывайте, если нужно проверить цену, рекламу или себестоимость.</p>
            </div>
            <StatusBadge label="Сценарий" value="info" />
          </summary>
          <div className="button-row">
            <Link className="button button--ghost" href={calculatorHref}>
              Перейти в калькулятор
            </Link>
          </div>
          <section className="summary-card-grid">
            <StatCard
              hint="Ниже этого уровня SKU станет убыточным"
              label="Критическая цена"
              tone="warning"
              value={data.calculatorPreview.breakEvenPrice ? formatCurrency(data.calculatorPreview.breakEvenPrice) : "Не считается"}
            />
            <StatCard
              hint="Реклама выше этого уровня уже съедает прибыль на единице"
              label="Допустимая реклама"
              tone="warning"
              value={formatCurrency(data.calculatorPreview.maxAdSpend)}
            />
            <StatCard
              hint="Выше этого уровня закупка уводит SKU в минус"
              label="Критическая себестоимость"
              tone="warning"
              value={formatCurrency(data.calculatorPreview.maxCostPrice)}
            />
          </section>
        </details>
      ) : null}

      <details className="form-card details-card" open={Boolean(data.incompleteEconomics)}>
        <summary className="details-card__summary">
          <div>
            <strong>Уточнить себестоимость и затраты</strong>
            <p className="muted">Служебный блок для корректировки экономики по SKU.</p>
          </div>
          <StatusBadge label={data.latestCostProfile?.isComplete ? "Профиль есть" : "Нужна проверка"} value={data.latestCostProfile?.isComplete ? "success" : "warning"} />
        </summary>
        <form action={saveCostProfileAction.bind(null, data.sku.id)} className="form-grid">
          <div className="field">
            <label htmlFor="effectiveFrom">Действует с</label>
            <input defaultValue={new Date().toISOString().slice(0, 10)} id="effectiveFrom" name="effectiveFrom" type="date" />
          </div>
          <div className="field">
            <label htmlFor="cogsRub">Себестоимость, ₽</label>
            <input defaultValue={data.latestCostProfile?.cogsRub ?? ""} id="cogsRub" min="0" name="cogsRub" step="0.01" type="number" />
          </div>
          <div className="field">
            <label htmlFor="packagingRub">Упаковка, ₽</label>
            <input defaultValue={data.latestCostProfile?.packagingRub ?? 0} id="packagingRub" min="0" name="packagingRub" step="0.01" type="number" />
          </div>
          <div className="field">
            <label htmlFor="handlingRub">Обработка, ₽</label>
            <input defaultValue={data.latestCostProfile?.handlingRub ?? 0} id="handlingRub" min="0" name="handlingRub" step="0.01" type="number" />
          </div>
          <div className="field">
            <label htmlFor="otherUnitCostRub">Прочие на единицу, ₽</label>
            <input defaultValue={data.latestCostProfile?.otherUnitCostRub ?? 0} id="otherUnitCostRub" min="0" name="otherUnitCostRub" step="0.01" type="number" />
          </div>
          <div className="field field--checkbox">
            <label htmlFor="isComplete">Экономика полная</label>
            <input defaultChecked={data.latestCostProfile?.isComplete ?? true} id="isComplete" name="isComplete" type="checkbox" />
          </div>
          <div className="field field--full">
            <label htmlFor="notes">Комментарий</label>
            <textarea defaultValue={data.latestCostProfile?.notes ?? ""} id="notes" name="notes" placeholder="Например: новая закупочная цена с апреля" />
          </div>
          <div className="field field--full">
            <SubmitButton pendingText="Сохраняем профиль...">Сохранить профиль затрат</SubmitButton>
          </div>
        </form>
      </details>

      <details className="table-card section-stack details-card">
        <summary className="details-card__summary">
          <div>
            <strong>Контекст по дням</strong>
            <p className="muted">Вторичный слой для сверки динамики. Решение по SKU должно быть понятно выше.</p>
          </div>
          <StatusBadge label="Вторично" value="info" />
        </summary>
        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Выручка</th>
              <th>Вклад в прибыль</th>
              <th>Маржа</th>
            </tr>
          </thead>
          <tbody>
            {data.series.map((point) => (
              <tr key={String(point.metricDate)}>
                <td>{formatDate(point.metricDate)}</td>
                <td>{formatCurrency(point.netRevenueRub)}</td>
                <td className={point.contributionProfitRub >= 0 ? "text-success" : "text-danger"}>{formatCurrency(point.contributionProfitRub)}</td>
                <td>{formatPercent(point.marginPct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </main>
  );
}
