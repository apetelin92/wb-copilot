import Link from "next/link";

import { applyDemoScenarioAction, connectWbAction, runSyncAction, saveCashInputsAction, seedDemoWorkspaceAction } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getCurrentSessionUser } from "@/server/modules/auth/session";
import { getDemoWorkspaceState } from "@/server/modules/demo/service";
import { getOnboardingState } from "@/server/modules/onboarding/service";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({ searchParams }: { searchParams?: { connectionError?: string } }) {
  const [user, state, demoState] = await Promise.all([getCurrentSessionUser(), getOnboardingState(), getDemoWorkspaceState()]);
  const isDemoWorkspace = user?.workspaceKind === "demo";
  const connectionError = searchParams?.connectionError ? decodeURIComponent(searchParams.connectionError) : null;
  const completedSteps = state.steps.filter((step) => step.isDone).length + (state.dailyMetricCount > 0 ? 1 : 0);
  const setupSteps = [
    {
      key: "connect",
      title: "1. Подключить маркетплейс",
      description: isDemoWorkspace ? "Подключите demo-кабинет или оставьте тестовые значения." : "Подключите рабочий кабинет WB.",
      done: state.connection?.status === "CONNECTED",
      href: "#wb-connection",
      ctaLabel: "Подключить"
    },
    {
      key: "sync",
      title: "2. Синхронизировать данные",
      description: "После sync появятся SKU, продажи и первый расчёт прибыли.",
      done: state.dailyMetricCount > 0,
      href: "#first-sync",
      ctaLabel: "Запустить"
    },
    {
      key: "cash",
      title: "3. Внести кассу",
      description: "Остаток и обязательства нужны для прогноза последствий.",
      done: Boolean(state.latestSnapshot),
      href: "#cash-inputs",
      ctaLabel: "Заполнить"
    },
    {
      key: "costs",
      title: "4. Внести себестоимость SKU",
      description: "Без cost data прибыль по части товаров неполная.",
      done: state.costProfileCount > 0,
      href: "#costs",
      ctaLabel: "Открыть"
    },
    {
      key: "open",
      title: "5. Открыть проблемные SKU",
      description: "После запуска переходите сразу в рабочий список под вниманием.",
      done: state.dailyMetricCount > 0,
      href: "/skus?profitability=attention",
      ctaLabel: "Открыть"
    }
  ];

  return (
    <main className="page">
      <PageHeader
        eyebrow="Setup"
        badges={
          <>
            <StatusBadge label={isDemoWorkspace ? "Демо-режим" : "Рабочий режим"} value={user?.workspaceKind ?? "info"} />
            <StatusBadge label={`Готово ${completedSteps}/5`} value={completedSteps >= 4 ? "success" : "warning"} />
          </>
        }
        title="Онбординг"
        description="Короткий запуск: подключение → sync → касса → себестоимость → проблемные SKU."
        actions={
          <div className="button-row">
            {state.dailyMetricCount > 0 ? (
              <Link className="button button--primary" href="/skus?profitability=attention">
                Открыть проблемные SKU
              </Link>
            ) : null}
            {isDemoWorkspace ? (
              <form action={seedDemoWorkspaceAction}>
                <SubmitButton pendingText="Заполняем..." variant="secondary">
                  Подготовить demo-данные
                </SubmitButton>
              </form>
            ) : null}
          </div>
        }
      />

      {connectionError ? (
        <section className="alert alert--danger">
          <strong>Не удалось подключить WB.</strong>
          <p>{connectionError}</p>
        </section>
      ) : null}

      <section className="panel panel--calm section-stack">
        <div className="section-heading">
          <h2>Шаги запуска</h2>
          <p className="muted">Достаточно закрыть эти 5 шагов, чтобы перейти к ежедневной работе.</p>
        </div>
        <div className="journey-grid journey-grid--compact">
          {setupSteps.map((step) => (
            <article className={`journey-card journey-card--static ${step.done ? "readiness-card--done" : "readiness-card--pending"}`} key={step.key}>
              <div className="meta-row">
                <strong>{step.title}</strong>
                <StatusBadge label={step.done ? "Готово" : "Нужно действие"} value={step.done ? "success" : "warning"} />
              </div>
              <p>{step.description}</p>
              <Link className="button button--ghost button--small" href={step.href}>
                {step.ctaLabel}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <details className="form-card section-stack details-card" id="wb-connection" open={state.connection?.status !== "CONNECTED"}>
        <summary className="details-card__summary">
          <div>
            <strong>1. Подключение WB</strong>
            <p className="muted">Сохраните кабинет и токен для текущего пространства.</p>
          </div>
          {state.connection ? <StatusBadge value={state.connection.status} /> : <StatusBadge label="Не подключено" value="warning" />}
        </summary>
        <form action={connectWbAction} className="form-grid">
          <div className="field">
            <label htmlFor="name">Название кабинета</label>
            <input defaultValue={state.connection?.name ?? (isDemoWorkspace ? "Демо кабинет WB" : "WB Кабинет")} id="name" name="name" type="text" />
          </div>
          <div className="field">
            <label htmlFor="cabinetId">Cabinet ID</label>
            <input defaultValue={state.connection?.cabinetId ?? (isDemoWorkspace ? "mock-cabinet" : "")} id="cabinetId" name="cabinetId" placeholder={isDemoWorkspace ? "mock-cabinet" : "Например: 12345678"} type="text" />
          </div>
          <div className="field field--full">
            <label htmlFor="apiToken">API token</label>
            <input defaultValue={isDemoWorkspace ? "demo-token-12345" : ""} id="apiToken" name="apiToken" placeholder={isDemoWorkspace ? "demo-token-12345" : "Вставьте реальный токен WB"} type="password" />
          </div>
          <div className="field field--full">
            <SubmitButton pendingText="Подключаем кабинет...">Сохранить подключение</SubmitButton>
          </div>
        </form>
        {state.connection?.lastVerifiedAt ? <p className="form-help">Проверено: {formatDateTime(state.connection.lastVerifiedAt)}</p> : null}
      </details>

      <details className="form-card section-stack details-card" id="first-sync" open={state.dailyMetricCount === 0}>
        <summary className="details-card__summary">
          <div>
            <strong>2. Первая синхронизация</strong>
            <p className="muted">Подтяните SKU, продажи, комиссии и расчёт прибыли.</p>
          </div>
          {state.latestSync ? <StatusBadge value={state.latestSync.status} /> : <StatusBadge label="Не запускалась" value="warning" />}
        </summary>
        <div className="button-row">
          <form action={runSyncAction}>
            <SubmitButton pendingText="Синхронизируем...">Запустить синхронизацию</SubmitButton>
          </form>
          <Link className="button button--ghost" href="/settings">
            Открыть журнал sync
          </Link>
        </div>
        {state.latestSync ? (
          <div className={`alert ${state.dailyMetricCount > 0 ? "alert--success" : "alert--warning"}`}>
            <strong>Последний запуск:</strong> {state.latestSync.status.toLowerCase()} · {formatDateTime(state.latestSync.startedAt)}
          </div>
        ) : (
          <div className="alert alert--warning">Синхронизация ещё не запускалась.</div>
        )}
      </details>

      <details className="form-card section-stack details-card" id="cash-inputs" open={!state.latestSnapshot}>
        <summary className="details-card__summary">
          <div>
            <strong>3. Остаток денег и обязательства</strong>
            <p className="muted">Нужно для прогноза кассового эффекта после решений по SKU.</p>
          </div>
          <StatusBadge label={state.latestSnapshot ? "Заполнено" : "Нужно действие"} value={state.latestSnapshot ? "success" : "warning"} />
        </summary>
        <form action={saveCashInputsAction} className="form-grid">
          <div className="field">
            <label htmlFor="snapshotDate">Дата остатка</label>
            <input defaultValue={new Date().toISOString().slice(0, 10)} id="snapshotDate" name="snapshotDate" type="date" />
          </div>
          <div className="field">
            <label htmlFor="availableRub">Доступно денег, ₽</label>
            <input defaultValue={state.latestSnapshot?.availableRub ?? 150000} id="availableRub" min="0" name="availableRub" step="0.01" type="number" />
          </div>
          <div className="field">
            <label htmlFor="title">Ближайшее обязательство</label>
            <input id="title" name="title" placeholder="Налог, закупка, зарплата" type="text" />
          </div>
          <div className="field">
            <label htmlFor="commitmentType">Тип обязательства</label>
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
            <label htmlFor="amountRub">Сумма обязательства, ₽</label>
            <input id="amountRub" min="0" name="amountRub" step="0.01" type="number" />
          </div>
          <div className="field field--full">
            <label htmlFor="notes">Комментарий</label>
            <textarea id="notes" name="notes" placeholder="Например: аванс поставщику или налог по УСН" />
          </div>
          <div className="field field--full">
            <SubmitButton pendingText="Сохраняем данные...">Сохранить входные данные</SubmitButton>
          </div>
        </form>
        {state.latestSnapshot ? <p className="form-help">Последний остаток: {formatCurrency(state.latestSnapshot.availableRub)} на {formatDateTime(state.latestSnapshot.snapshotDate)}</p> : null}
      </details>

      <details className="panel section-stack details-card" id="costs" open={state.costProfileCount === 0}>
        <summary className="details-card__summary">
          <div>
            <strong>4. Себестоимость SKU</strong>
            <p className="muted">Заполните cost data хотя бы для ключевых товаров.</p>
          </div>
          <StatusBadge label={state.costProfileCount > 0 ? "Есть данные" : "Нужно действие"} value={state.costProfileCount > 0 ? "success" : "warning"} />
        </summary>
        <ul className="info-list">
          <li>SKU в базе: {state.skuCount}</li>
          <li>Профилей себестоимости: {state.costProfileCount}</li>
          <li>Дневных расчётов прибыли: {state.dailyMetricCount}</li>
        </ul>
        <div className="button-row">
          <Link className="button button--primary" href="/skus?profitability=incomplete">
            Заполнить неполную экономику
          </Link>
          <Link className="button button--ghost" href="/skus?profitability=attention">
            Открыть проблемные SKU
          </Link>
        </div>
      </details>

      <section className="panel section-stack">
        <div className="meta-row">
          <h2>5. Открыть проблемные SKU</h2>
          <StatusBadge label={state.dailyMetricCount > 0 ? "Можно работать" : "После sync"} value={state.dailyMetricCount > 0 ? "success" : "warning"} />
        </div>
        <p className="muted">Основной рабочий маршрут начинается здесь: Today → SKU → решение → Cash → Calculator.</p>
        <div className="button-row">
          <Link className="button button--primary" href="/skus?profitability=attention">
            Открыть SKU под вниманием
          </Link>
          <Link className="button button--ghost" href="/dashboard">
            Открыть Сегодня
          </Link>
        </div>
      </section>

      {isDemoWorkspace && demoState ? (
        <details className="panel panel--muted section-stack details-card" open>
          <summary className="details-card__summary">
            <div>
              <strong>Demo mode</strong>
              <p className="muted">Вторичный режим для подготовки показов и тестовых сценариев.</p>
            </div>
            <StatusBadge label={`Активен: ${demoState.currentScenario.label}`} value="demo" />
          </summary>
          <div className="scenario-grid">
            {demoState.scenarios.map((scenario) => {
              const isActive = scenario.key === demoState.currentScenario.key;

              return (
                <article className={`scenario-card ${isActive ? "scenario-card--active" : ""}`} key={scenario.key}>
                  <div className="meta-row">
                    <strong>{scenario.label}</strong>
                    {isActive ? <StatusBadge label="Активен" value="demo" /> : null}
                  </div>
                  <p>{scenario.description}</p>
                  <form action={applyDemoScenarioAction.bind(null, scenario.key)}>
                    <SubmitButton pendingText="Перезаполняем..." variant={isActive ? "ghost" : "secondary"}>
                      {isActive ? "Обновить сценарий" : "Переключить"}
                    </SubmitButton>
                  </form>
                </article>
              );
            })}
          </div>
        </details>
      ) : null}
    </main>
  );
}
