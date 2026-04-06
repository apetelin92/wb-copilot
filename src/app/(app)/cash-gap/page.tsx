import Link from "next/link";

import { saveCashInputsAction } from "@/app/actions";
import { CashTrajectoryChart } from "@/components/cash-trajectory-chart";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusSummaryBlock } from "@/components/status-summary-block";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { formatCurrency, formatDate } from "@/lib/format";
import { getCashGapWorkspaceData } from "@/server/modules/risk/service";
import { listSkuProfitability } from "@/server/modules/sku/service";

export const dynamic = "force-dynamic";

const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short"
});

function getTone(riskLevel?: string | null) {
  if (riskLevel === "RISK") {
    return "danger" as const;
  }

  if (riskLevel === "WATCH") {
    return "warning" as const;
  }

  return "success" as const;
}

function getRiskLabel(riskLevel?: string | null) {
  if (riskLevel === "RISK") {
    return "Высокий риск";
  }

  if (riskLevel === "WATCH") {
    return "Под риском";
  }

  return "Под контролем";
}

function getDaysUntilLabel(date: Date) {
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((targetDate.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) {
    return "сегодня";
  }

  if (diffDays === 1) {
    return "завтра";
  }

  return `через ${diffDays} дн.`;
}

function getCommitmentFocus(input: { dueDate: Date; minProjectedDate?: Date | null }) {
  const today = new Date();
  const diffDays = Math.round((input.dueDate.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays <= 1) {
    return { label: "Скоро", tone: "danger" as const };
  }

  if (input.minProjectedDate && input.dueDate <= input.minProjectedDate) {
    return { label: "До точки минимума", tone: "warning" as const };
  }

  return { label: "Планово", tone: "info" as const };
}

export default async function CashGapPage() {
  const [data, attentionView] = await Promise.all([getCashGapWorkspaceData(), listSkuProfitability({ profitability: "attention" })]);
  const tone = getTone(data.riskView?.riskLevel ?? null);
  const nearestCommitments = data.commitments.slice(0, 4);
  const nextCommitment = nearestCommitments[0] ?? null;
  const attentionCount = attentionView.summary.attentionCount;
  const projectionPoints = (data.riskView?.points ?? []).map((point) => ({
    label: shortDateFormatter.format(new Date(point.projectionDate)),
    value: point.projectedCashRub,
    inflowRub: point.inflowRub,
    outflowRub: point.outflowRub
  }));

  return (
    <main className="page">
      <PageHeader
        eyebrow="Последствие решений по SKU"
        badges={data.riskView ? <StatusBadge label={getRiskLabel(data.riskView.riskLevel)} value={tone} /> : <StatusBadge label="Нужны входные данные" value="warning" />}
        meta={
          data.riskView ? (
            <>
              <span className="meta-chip">Минимальный остаток: {formatCurrency(data.riskView.minProjectedCashRub)}</span>
              <span className="meta-chip">Дата минимума: {formatDate(data.riskView.minProjectedDate)}</span>
            </>
          ) : undefined
        }
        title="Касса"
        description="Последствие решений по SKU: сначала риск, потом ближайшие списания, затем траектория остатка."
        actions={
          <div className="button-row">
            <Link className="button button--primary" href="/skus?profitability=attention">
              {attentionCount > 0 ? `Открыть проблемные SKU (${attentionCount})` : "Открыть SKU"}
            </Link>
          </div>
        }
      />

      {data.riskView ? (
        <StatusSummaryBlock
          action={
            attentionCount > 0
              ? `Сначала разберите ${attentionCount} проблемных SKU, затем вернитесь к ближайшим списаниям.`
              : "Проверьте ближайшие списания и при необходимости обновите входные данные."
          }
          badgeLabel={getRiskLabel(data.riskView.riskLevel)}
          meta={[
            { label: "Минимальный остаток", value: formatCurrency(data.riskView.minProjectedCashRub) },
            { label: "Дата минимума", value: formatDate(data.riskView.minProjectedDate) },
            { label: "Ближайшее обязательство", value: nextCommitment ? `${nextCommitment.title} · ${formatCurrency(nextCommitment.amountRub)}` : "—" }
          ]}
          reason={data.riskView.explanation}
          title={data.riskView.riskLevel === "RISK" ? "Касса под давлением" : data.riskView.riskLevel === "WATCH" ? "Касса требует внимания" : "Касса под контролем"}
          tone={tone}
        />
      ) : (
        <EmptyState title="Прогноз пока пуст" description="Добавьте текущий остаток денег и хотя бы одно обязательство, чтобы увидеть кассовый эффект после решений по SKU." />
      )}

      {data.riskView ? (
        <section className="summary-card-grid">
          <StatCard hint="Короткий статус на текущем горизонте" label="Риск" tone={tone} value={getRiskLabel(data.riskView.riskLevel)} />
          <StatCard hint="Самая низкая точка на горизонте прогноза" label="Минимальный остаток" tone={tone} value={formatCurrency(data.riskView.minProjectedCashRub)} />
          <StatCard hint="Когда касса опускается в минимальную точку" label="Дата минимума" tone="default" value={formatDate(data.riskView.minProjectedDate)} />
          <StatCard
            hint={nextCommitment ? `${formatDate(nextCommitment.dueDate)} · ${formatCurrency(nextCommitment.amountRub)}` : "Ближайшие списания ещё не добавлены"}
            label="Ближайшее списание"
            tone={nextCommitment ? "warning" : "default"}
            value={nextCommitment ? nextCommitment.title : "—"}
          />
        </section>
      ) : null}

      {data.riskView ? (
        <CashTrajectoryChart
          badgeLabel={getRiskLabel(data.riskView.riskLevel)}
          points={projectionPoints}
          subtitle="После решений по SKU проверьте, где остаток опускается к минимуму." 
          title="Траектория остатка"
          valueFormatter={(value) => formatCurrency(value)}
        />
      ) : null}

      <section className="table-card section-stack">
        <div className="meta-row table-card__header">
          <div>
            <h2>Ближайшие обязательства</h2>
            <p className="muted">Сначала смотрите, что уйдёт из кассы раньше всего и что приходится на период до точки минимума.</p>
          </div>
          <span className="muted">Первые {nearestCommitments.length}</span>
        </div>
        {nearestCommitments.length === 0 ? (
          <p className="muted">Обязательства ещё не добавлены.</p>
        ) : (
          <ul className="info-list info-list--dense">
            {nearestCommitments.map((item) => (
              <li key={item.id}>
                <div className="checklist__row">
                  <div>
                    <div className="checklist__step-title">{item.title}</div>
                    <p>
                      {getDaysUntilLabel(item.dueDate)} · {formatDate(item.dueDate)} · {formatCurrency(item.amountRub)}
                    </p>
                  </div>
                  <div className="meta-row">
                    <StatusBadge label={getCommitmentFocus({ dueDate: item.dueDate, minProjectedDate: data.riskView?.minProjectedDate ?? null }).label} value={getCommitmentFocus({ dueDate: item.dueDate, minProjectedDate: data.riskView?.minProjectedDate ?? null }).tone} />
                    <StatusBadge value={item.commitmentType} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="form-card section-stack">
        <div className="section-heading">
          <h2>Обновить остаток и обязательства</h2>
          <p className="muted">Если прогноз выглядит неверно, сначала уточните текущий остаток денег и ближайшие списания.</p>
        </div>
        <form action={saveCashInputsAction} className="form-grid">
          <div className="field">
            <label htmlFor="snapshotDate">Дата остатка</label>
            <input defaultValue={new Date().toISOString().slice(0, 10)} id="snapshotDate" name="snapshotDate" type="date" />
          </div>
          <div className="field">
            <label htmlFor="availableRub">Доступный остаток, ₽</label>
            <input defaultValue={data.latestSnapshot?.availableRub ?? ""} id="availableRub" min="0" name="availableRub" step="0.01" type="number" />
          </div>
          <div className="field">
            <label htmlFor="title">Новое обязательство</label>
            <input id="title" name="title" placeholder="Например: закупка партии" type="text" />
          </div>
          <div className="field">
            <label htmlFor="commitmentType">Тип</label>
            <select defaultValue="OTHER" id="commitmentType" name="commitmentType">
              <option value="SUPPLIER">Поставщик</option>
              <option value="TAX">Налог</option>
              <option value="PAYROLL">Зарплата</option>
              <option value="OPERATIONS">Операционные</option>
              <option value="OTHER">Другое</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="dueDate">Дата платежа</label>
            <input id="dueDate" name="dueDate" type="date" />
          </div>
          <div className="field">
            <label htmlFor="amountRub">Сумма, ₽</label>
            <input id="amountRub" min="0" name="amountRub" step="0.01" type="number" />
          </div>
          <div className="field field--full">
            <label htmlFor="notes">Комментарий</label>
            <textarea id="notes" name="notes" placeholder="Например: оплата поставщику по новому контракту" />
          </div>
          <div className="field field--full">
            <SubmitButton pendingText="Сохраняем...">Сохранить и пересчитать</SubmitButton>
          </div>
        </form>
      </section>

      <details className="table-card section-stack details-card">
        <summary className="details-card__summary">
          <div>
            <strong>Детализация прогноза по дням</strong>
            <p className="muted">Нижний технический слой для сверки поступлений, списаний и точки минимума.</p>
          </div>
          <StatusBadge label="Вторично" value="info" />
        </summary>
        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Поступления</th>
              <th>Списания</th>
              <th>Остаток</th>
            </tr>
          </thead>
          <tbody>
            {(data.riskView?.points ?? []).map((point) => (
              <tr key={String(point.projectionDate)}>
                <td>{formatDate(point.projectionDate)}</td>
                <td>{formatCurrency(point.inflowRub)}</td>
                <td>{formatCurrency(point.outflowRub)}</td>
                <td className={point.projectedCashRub >= 0 ? "text-success" : "text-danger"}>{formatCurrency(point.projectedCashRub)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </main>
  );
}
