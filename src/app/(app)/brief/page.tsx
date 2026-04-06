import { formatCurrency, formatDate, formatDateTime, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { StatusBadge } from "@/components/status-badge";
import { getCurrentSessionUser } from "@/server/modules/auth/session";
import { getDashboardData } from "@/server/modules/dashboard/service";
import { listSkuProfitability } from "@/server/modules/sku/service";

export const dynamic = "force-dynamic";

export default async function BriefPage() {
  const [user, dashboard, skuView] = await Promise.all([getCurrentSessionUser(), getDashboardData(), listSkuProfitability({ profitability: "attention" })]);

  return (
    <main className="page brief-page">
      <PageHeader
        eyebrow="Экспортный режим"
        badges={
          <>
            <StatusBadge label="Для PDF и обсуждения" value="info" />
            <StatusBadge label={dashboard.businessStatus.title} value={dashboard.businessStatus.tone} />
          </>
        }
        meta={
          <>
            <span className="meta-chip">Организация: {user?.organizationName ?? "MarginPoint"}</span>
            <span className="meta-chip">Срез: {formatDate(dashboard.asOfDate)}</span>
          </>
        }
        title="Бриф"
        description={`Подготовлено ${formatDateTime(new Date())}. Короткий итог для отправки, созвона или PDF.`}
        actions={
          <div className="button-row">
            <PrintButton />
          </div>
        }
      />

      <section className="panel brief-panel section-stack">
        <div className="meta-row table-card__header">
          <div>
            <h2>Краткий итог</h2>
            <p className="muted">Только главное для отправки или обсуждения.</p>
          </div>
          <StatusBadge label="Короткая версия" value="info" />
        </div>
        <section className="summary-card-grid">
          <article className="formula-step formula-step--accent">
            <span>Вклад в прибыль</span>
            <strong>{dashboard.overview ? formatCurrency(dashboard.overview.totalContributionRub) : "—"}</strong>
          </article>
          <article className="formula-step">
            <span>Убыточные SKU</span>
            <strong>{dashboard.overview ? dashboard.overview.lossMakingSkuCount : "—"}</strong>
          </article>
          <article className="formula-step">
            <span>Требуют внимания</span>
            <strong>{dashboard.overview ? dashboard.overview.attentionSkuCount : "—"}</strong>
          </article>
        </section>
        <p>{dashboard.dailyFocus.summary}</p>
      </section>

      <section className="panel brief-panel">
        <div className="meta-row">
          <h2>Приоритеты</h2>
          <StatusBadge value="info" label="Что делать" />
        </div>
        <div className="brief-list">
          {dashboard.actionCenter.slice(0, 3).map((action) => (
            <article className={`action-card action-card--${action.tone}`} key={action.id}>
              <strong>{action.title}</strong>
              <p>{action.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="table-card brief-panel section-stack">
        <div className="meta-row table-card__header">
          <div>
            <h2>Проблемные SKU</h2>
            <p className="muted">Короткий список: что теряет деньги и что делать дальше.</p>
          </div>
        </div>
        {skuView.items.length === 0 ? (
          <p className="muted">Сейчас нет SKU, которые требуют срочного внимания.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Статус</th>
                <th>Причина</th>
                <th>Что делать</th>
                <th>Прибыль</th>
                <th>Маржа</th>
              </tr>
            </thead>
            <tbody>
              {skuView.items.slice(0, 5).map((sku) => (
                <tr key={sku.skuId}>
                  <td>{sku.title}</td>
                  <td>{sku.healthLabel}</td>
                  <td>{sku.primaryReason}</td>
                  <td>{sku.recommendedAction}</td>
                  <td className={sku.contributionProfitRub >= 0 ? "text-success" : "text-danger"}>{formatCurrency(sku.contributionProfitRub)}</td>
                  <td>{formatPercent(sku.marginPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {dashboard.cashGapRisk ? (
        <section className="panel brief-panel">
          <div className="meta-row">
            <h2>Кассовый блок</h2>
            <StatusBadge value={dashboard.cashGapRisk.riskLevel} />
          </div>
          <p>{dashboard.cashGapRisk.explanation}</p>
          <div className="summary-inline-meta">
            <div className="summary-inline-item">
              <span>Минимальный остаток</span>
              <strong>{formatCurrency(dashboard.cashGapRisk.minProjectedCashRub)}</strong>
            </div>
            <div className="summary-inline-item">
              <span>Следующий шаг</span>
              <strong>SKU → Касса</strong>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
