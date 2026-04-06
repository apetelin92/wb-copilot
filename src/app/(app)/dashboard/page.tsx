import Link from "next/link";

import { runSyncAction } from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SkuDecisionTable } from "@/components/sku-decision-table";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { getCurrentSessionUser } from "@/server/modules/auth/session";
import { getDashboardData } from "@/server/modules/dashboard/service";
import { listSkuProfitability } from "@/server/modules/sku/service";
import { getWbConnection } from "@/server/modules/wb/service";

export const dynamic = "force-dynamic";

function getCashRiskLabel(riskLevel?: string | null) {
  if (riskLevel === "RISK") {
    return "Есть риск разрыва";
  }

  if (riskLevel === "WATCH") {
    return "Нужно наблюдение";
  }

  return "Касса под контролем";
}

function getCashTone(riskLevel?: string | null): "success" | "warning" | "danger" {
  if (riskLevel === "RISK") {
    return "danger";
  }

  if (riskLevel === "WATCH") {
    return "warning";
  }

  return "success";
}

function getCashSummary(risk: { explanation: string } | null) {
  if (!risk) {
    return "Прогноз кассы ещё не готов.";
  }

  return risk.explanation;
}

function getCashMinDate(risk: { points: Array<{ projectionDate: Date; projectedCashRub: number }> } | null) {
  if (!risk || risk.points.length === 0) {
    return "—";
  }

  const minPoint = risk.points.reduce((current, point) => (point.projectedCashRub < current.projectedCashRub ? point : current), risk.points[0]);

  return formatDate(minPoint.projectionDate);
}

function buildTodayActionCards(data: Awaited<ReturnType<typeof getDashboardData>>) {
  const overview = data.overview ?? {
    attentionSkuCount: 0,
    lossMakingSkuCount: 0,
    incompleteEconomicsCount: 0,
    atRiskSkuCount: 0
  };

  const cards: Array<{
    id: string;
    title: string;
    description: string;
    href: string;
    ctaLabel: string;
    tone: "success" | "warning" | "danger" | "info";
  }> = [];

  if (overview.lossMakingSkuCount > 0) {
    cards.push({
      id: "loss",
      title: `Остановить потери по ${overview.lossMakingSkuCount} SKU`,
      description: "Они уже тянут вклад в прибыль вниз.",
      href: "/skus?profitability=loss",
      ctaLabel: "Разобрать убыточные SKU",
      tone: "danger"
    });
  }

  if (overview.incompleteEconomicsCount > 0) {
    cards.push({
      id: "incomplete",
      title: `Закрыть неполную экономику у ${overview.incompleteEconomicsCount} SKU`,
      description: "Сейчас по ним нельзя полностью доверять прибыли.",
      href: "/skus?profitability=incomplete",
      ctaLabel: "Открыть неполную экономику",
      tone: "warning"
    });
  }

  if (overview.atRiskSkuCount > 0) {
    cards.push({
      id: "at-risk",
      title: `Защитить маржу у ${overview.atRiskSkuCount} SKU`,
      description: "Они ещё в плюсе, но запас уже слишком тонкий.",
      href: "/skus?profitability=at_risk",
      ctaLabel: "Открыть SKU под риском",
      tone: "warning"
    });
  }

  cards.push({
    id: "attention",
    title: "Открыть рабочий список",
    description:
      overview.attentionSkuCount > 0
        ? `${overview.attentionSkuCount} SKU требуют решения сегодня.`
        : "Список внимания пуст — проверьте сильные позиции.",
    href: "/skus?profitability=attention",
    ctaLabel: "Открыть SKU под вниманием",
    tone: overview.attentionSkuCount > 0 ? "info" : "success"
  });

  if (cards.length === 1) {
    cards.unshift({
      id: "positive",
      title: "Проверить прибыльные SKU",
      description: "Если срочных проблем нет, удерживайте сильные позиции.",
      href: "/skus?profitability=positive",
      ctaLabel: "Открыть прибыльные SKU",
      tone: "success"
    });
  }

  return cards.slice(0, 4);
}

export default async function DashboardPage() {
  const [user, connection, data, attentionSkus] = await Promise.all([
    getCurrentSessionUser(),
    getWbConnection(),
    getDashboardData(),
    listSkuProfitability({ profitability: "attention" })
  ]);
  const isDemoWorkspace = user?.workspaceKind === "demo";

  if (!connection) {
    return (
      <main className="page">
        <PageHeader title="Сегодня" description={isDemoWorkspace ? "В demo workspace можно быстро восстановить тестовые данные и сценарии." : "Сначала подключите кабинет WB, чтобы видеть прибыль, проблемные SKU и риск кассового разрыва."} />
        <EmptyState
          title={isDemoWorkspace ? "Demo-данные не готовы" : "Сначала подключите кабинет WB"}
          description={
            isDemoWorkspace
              ? "Восстановите demo-кабинет, чтобы вернуть тестовые SKU, кассу и сценарии."
              : "После подключения и первой синхронизации MarginPoint покажет, где теряется прибыль и какие SKU требуют решения в первую очередь."
          }
          actionHref="/onboarding"
          actionLabel={isDemoWorkspace ? "Открыть восстановление demo" : "Перейти к подключению"}
        />
      </main>
    );
  }

  if (!data.overview) {
    return (
      <main className="page">
        <PageHeader
          title="Сегодня"
          description={isDemoWorkspace ? "В demo workspace можно заново поднять тестовые данные одним действием." : "После первой синхронизации здесь появятся потери по SKU, рабочий список и кассовый статус."}
          actions={
            isDemoWorkspace ? (
              <Link className="button button--primary" href="/onboarding">
                Восстановить demo-данные
              </Link>
            ) : (
              <form action={runSyncAction}>
                <SubmitButton pendingText="Синхронизируем...">Запустить первую синхронизацию</SubmitButton>
              </form>
            )
          }
        />
        <EmptyState
          title={isDemoWorkspace ? "Demo-расчёты не готовы" : "Данных пока нет"}
          description={
            isDemoWorkspace
              ? "Перейдите в онбординг и нажмите «Подготовить demo-данные», чтобы вернуть тестовый контур и сценарии."
              : "Кабинет подключён, но расчёты ещё не готовы. Запустите синхронизацию, чтобы увидеть рабочий список SKU на сегодня."
          }
          actionHref="/onboarding"
          actionLabel={isDemoWorkspace ? "Восстановить demo" : "Открыть онбординг"}
        />
      </main>
    );
  }

  const todayActionCards = buildTodayActionCards(data);
  const criticalSkus = attentionSkus.items.slice(0, 4);

  return (
    <main className="page">
      <PageHeader
        eyebrow="Сегодня"
        badges={
          <>
            <StatusBadge label={data.businessStatus.title} value={data.businessStatus.tone} />
            <StatusBadge label={`Требуют внимания: ${data.overview.attentionSkuCount}`} value={data.overview.attentionSkuCount > 0 ? "warning" : "success"} />
          </>
        }
        meta={
          <>
            <span className="meta-chip">Вклад в прибыль: {formatCurrency(data.overview.totalContributionRub)}</span>
            <span className="meta-chip">Убыточные: {data.overview.lossMakingSkuCount}</span>
            <span className="meta-chip">Под риском: {data.overview.atRiskSkuCount}</span>
          </>
        }
        title="Сегодня"
        description={data.latestSync ? `Обновлено ${formatDateTime(data.latestSync.startedAt)}. Сначала разберите проблемные SKU.` : "Сначала разберите проблемные SKU."}
        actions={
          <div className="button-row">
            <Link className="button button--primary" href="/skus?profitability=attention">
              Открыть рабочий список SKU
            </Link>
            <form action={runSyncAction}>
              <SubmitButton pendingText="Синхронизируем..." variant="ghost">
                Обновить данные
              </SubmitButton>
            </form>
          </div>
        }
      />

      <section className="summary-card-grid">
        <StatCard
          footer="Открыть SKU под вниманием"
          hint="Главный вход в точки потери прибыли сегодня"
          href="/skus?profitability=attention"
          label="Вклад в прибыль"
          tone={data.overview.totalContributionRub >= 0 ? "success" : "danger"}
          value={formatCurrency(data.overview.totalContributionRub)}
        />
        <StatCard
          footer="Открыть убыточные SKU"
          hint={data.overview.lossFromUnprofitableSkusRub > 0 ? `Потери: ${formatCurrency(data.overview.lossFromUnprofitableSkusRub)}` : "Прямых потерь по SKU сейчас не видно"}
          href="/skus?profitability=loss"
          label="Убыточные SKU"
          tone={data.overview.lossMakingSkuCount > 0 ? "danger" : "success"}
          value={String(data.overview.lossMakingSkuCount)}
        />
        <StatCard
          footer="Открыть SKU под риском"
          hint="Низкая маржа: масштабировать без пересчёта рискованно"
          href="/skus?profitability=at_risk"
          label="Под риском"
          tone={data.overview.atRiskSkuCount > 0 ? "warning" : "success"}
          value={String(data.overview.atRiskSkuCount)}
        />
        <StatCard
          footer="Открыть неполную экономику"
          hint="По этим SKU нельзя полностью доверять прибыли"
          href="/skus?profitability=incomplete"
          label="Неполная экономика"
          tone={data.overview.incompleteEconomicsCount > 0 ? "warning" : "success"}
          value={String(data.overview.incompleteEconomicsCount)}
        />
      </section>

      <section className="panel panel--calm section-stack">
        <div className="section-heading">
          <h2>Что сделать сегодня</h2>
          <p className="muted">Только ближайшие решения по прибыли на сегодня.</p>
        </div>
        <div className="today-action-grid">
          {todayActionCards.map((action) => (
            <Link className={`today-action-card today-action-card--${action.tone}`} href={action.href} key={action.id}>
              <strong className="today-action-card__title">{action.title}</strong>
              <span className="today-action-card__text">{action.description}</span>
              <span className="today-action-card__cta">{action.ctaLabel}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="table-card section-stack">
        <div className="meta-row table-card__header">
          <div>
            <h2>Проблемные SKU</h2>
            <p className="muted">Откройте SKU, примите решение и при необходимости уйдите в калькулятор.</p>
          </div>
          <Link className="button button--ghost" href="/skus?profitability=attention">
            Открыть все SKU под вниманием
          </Link>
        </div>
        {criticalSkus.length > 0 ? (
          <SkuDecisionTable activeFilter="attention" items={criticalSkus} />
        ) : (
          <EmptyState
            title="Срочных SKU пока нет"
            description="Список внимания пуст. Можно перейти к прибыльным SKU или обновить данные."
            actionHref="/skus?profitability=positive"
            actionLabel="Открыть прибыльные SKU"
          />
        )}
      </section>

      <section className={`panel compact-cash-card compact-cash-card--${getCashTone(data.cashGapRisk?.riskLevel ?? null)}`}>
        <div className="compact-cash-card__content">
          <div className="meta-row">
            <StatusBadge label="Касса" value={getCashTone(data.cashGapRisk?.riskLevel ?? null)} />
          </div>
          <h2>{data.cashGapRisk ? getCashRiskLabel(data.cashGapRisk.riskLevel) : "Прогноз не готов"}</h2>
          <p className="muted">{getCashSummary(data.cashGapRisk)}</p>
        </div>
        <div className="compact-cash-card__stats">
          <div className="compact-cash-card__meta">
            <span>Минимальный остаток</span>
            <strong>{data.cashGapRisk ? formatCurrency(data.cashGapRisk.minProjectedCashRub) : "—"}</strong>
          </div>
          <div className="compact-cash-card__meta">
            <span>Дата минимума</span>
            <strong>{getCashMinDate(data.cashGapRisk)}</strong>
          </div>
        </div>
        <Link className="button button--ghost" href="/cash-gap">
          Открыть кассу
        </Link>
      </section>
    </main>
  );
}
