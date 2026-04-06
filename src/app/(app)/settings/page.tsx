import Link from "next/link";
import { UserRole } from "@prisma/client";

import {
  applyDemoScenarioAction,
  connectWbAction,
  createWorkspaceInviteAction,
  revokeWorkspaceInviteAction,
  retrySyncRunAction,
  runSyncAction,
  switchWorkspaceAction
} from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { formatDateTime } from "@/lib/format";
import { env } from "@/server/lib/env";
import { getCurrentSessionUser } from "@/server/modules/auth/session";
import { listWorkspaceInvites } from "@/server/modules/auth/invite.service";
import { getDemoWorkspaceState } from "@/server/modules/demo/service";
import { getWorkspaceOperationalStatus, humanizeSyncErrorMessage } from "@/server/modules/ops-status/service";
import { getWbConnection } from "@/server/modules/wb/service";
import { listSyncRuns } from "@/server/modules/wb/sync.service";

export const dynamic = "force-dynamic";

function getSearchMessage(value?: string) {
  return value ? decodeURIComponent(value) : null;
}

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: { syncError?: string; inviteError?: string; accessError?: string };
}) {
  const user = await getCurrentSessionUser();
  const [connection, syncRuns, demoState, opsStatus, invites] = await Promise.all([
    getWbConnection(),
    listSyncRuns(),
    getDemoWorkspaceState(),
    getWorkspaceOperationalStatus(),
    user?.role === UserRole.ADMIN ? listWorkspaceInvites(user.organizationId).catch(() => []) : Promise.resolve([])
  ]);

  const isDemoWorkspace = user?.workspaceKind === "demo";
  const isAdmin = user?.role === UserRole.ADMIN;
  const connectionModeLabel = isDemoWorkspace ? "Демо-режим" : env.wbApiBaseUrl ? "Рабочий режим через прокси" : "Рабочий режим через официальный API WB";
  const syncError = getSearchMessage(searchParams?.syncError);
  const inviteError = getSearchMessage(searchParams?.inviteError);
  const accessError = getSearchMessage(searchParams?.accessError);
  const latestRun = syncRuns[0] ?? null;
  const latestCompletedSync = syncRuns.find((run) => run.status === "COMPLETED") ?? null;

  return (
    <main className="page">
      <PageHeader
        eyebrow="Workspace settings"
        badges={
          <>
            <StatusBadge label={isDemoWorkspace ? "Демо-режим" : "Рабочий режим"} value={user?.workspaceKind ?? "info"} />
            {user ? <StatusBadge value={user.role} /> : null}
            <StatusBadge label={opsStatus.syncHealth.label} value={opsStatus.syncHealth.tone} />
          </>
        }
        meta={
          <>
            <span className="meta-chip">Режим подключения: {connectionModeLabel}</span>
            <span className="meta-chip">Неполные SKU: {opsStatus.incompleteSkuCount}</span>
          </>
        }
        title="Настройки"
        description="Служебные настройки: подключение, sync, доступ и demo mode. Основной рабочий маршрут остаётся в Today и SKU."
      />

      <section className="summary-card-grid">
        <StatCard
          hint={connection ? connectionModeLabel : "Сначала сохраните кабинет и токен"}
          label="Подключение"
          tone={connection?.status === "CONNECTED" ? "success" : "warning"}
          value={connection?.status === "CONNECTED" ? "Готово" : "Не настроено"}
        />
        <StatCard
          hint={opsStatus.syncHealth.description}
          label="Свежесть данных"
          tone={opsStatus.syncHealth.tone}
          value={opsStatus.syncHealth.label}
        />
        <StatCard
          hint={latestCompletedSync ? `Последний успешный запуск: ${formatDateTime(latestCompletedSync.startedAt)}` : "Успешных sync пока не было"}
          label="Последний sync"
          tone={latestCompletedSync ? "success" : "warning"}
          value={latestCompletedSync ? formatDateTime(latestCompletedSync.startedAt) : "—"}
        />
      </section>

      {syncError ? (
        <section className="alert alert--danger">
          <strong>Sync завершился с ошибкой.</strong>
          <p>{syncError}</p>
        </section>
      ) : null}
      {inviteError ? (
        <section className="alert alert--danger">
          <strong>Не удалось обработать приглашение.</strong>
          <p>{inviteError}</p>
        </section>
      ) : null}
      {accessError ? (
        <section className="alert alert--warning">
          <strong>Ограничение доступа.</strong>
          <p>{accessError}</p>
        </section>
      ) : null}

      <section className="section-stack">
        <div className="section-heading">
          <h2>Подключение</h2>
          <p className="muted">Состояние кабинета WB и форма подключения.</p>
        </div>
        <section className="two-column">
          <article className="panel">
            <div className="meta-row">
              <h2>Текущее подключение</h2>
              {connection ? <StatusBadge value={connection.status} /> : <StatusBadge label="Не подключено" value="warning" />}
            </div>
            <ul className="info-list">
              <li>Название: {connection?.name ?? "—"}</li>
              <li>ID кабинета: {connection?.cabinetId ?? "—"}</li>
              <li>Режим: {connectionModeLabel}</li>
              <li>Последняя проверка: {connection?.lastVerifiedAt ? formatDateTime(connection.lastVerifiedAt) : "—"}</li>
              <li>Последняя успешная синхронизация: {connection?.lastSyncAt ? formatDateTime(connection.lastSyncAt) : "—"}</li>
              <li>Последняя ошибка: {connection?.lastError ? humanizeSyncErrorMessage(connection.lastError) : "—"}</li>
            </ul>
          </article>

          <article className="panel">
            <div className="meta-row">
              <h2>Обновить подключение</h2>
              {isAdmin ? <StatusBadge label="Admin" value="admin" /> : <StatusBadge label="Read only" value="info" />}
            </div>
            {isAdmin ? (
              <form action={connectWbAction} className="form-grid">
                <div className="field">
                  <label htmlFor="name">Название кабинета</label>
                  <input defaultValue={connection?.name ?? (isDemoWorkspace ? "Демо кабинет WB" : "WB Кабинет")} id="name" name="name" type="text" />
                  <p className="field-help">Это имя видно в интерфейсе и помогает различать кабинеты.</p>
                </div>
                <div className="field">
                  <label htmlFor="cabinetId">Cabinet ID</label>
                  <input defaultValue={connection?.cabinetId ?? (isDemoWorkspace ? "mock-cabinet" : "")} id="cabinetId" name="cabinetId" type="text" />
                  <p className="field-help">Необязательное поле, но полезно для поддержки и прозрачности.</p>
                </div>
                <div className="field field--full">
                  <label htmlFor="apiToken">API-токен</label>
                  <input defaultValue={isDemoWorkspace ? "demo-token-12345" : ""} id="apiToken" name="apiToken" placeholder={isDemoWorkspace ? "demo-token-12345" : "Вставьте реальный токен WB"} type="password" />
                  <p className="field-help">Для live-режима токен должен иметь доступ к content и statistics API Wildberries.</p>
                </div>
                <div className="field field--full">
                  <SubmitButton pendingText="Сохраняем...">Сохранить подключение</SubmitButton>
                </div>
              </form>
            ) : (
              <p className="muted">Изменение подключения доступно только администратору.</p>
            )}
          </article>
        </section>
      </section>

      <section className="section-stack">
        <div className="section-heading">
          <h2>Sync и доверие к данным</h2>
          <p className="muted">Запускайте sync и сверяйте, насколько данным сейчас можно доверять.</p>
        </div>
        <section className="two-column">
          <article className="panel panel--calm">
            <div className="meta-row">
              <h2>Статус данных</h2>
              <StatusBadge label={opsStatus.syncHealth.label} value={opsStatus.syncHealth.tone} />
            </div>
            <ul className="info-list">
              <li>Последний успешный sync: {opsStatus.latestCompletedSync?.startedAt ? formatDateTime(opsStatus.latestCompletedSync.startedAt) : "—"}</li>
              <li>Последний запуск: {opsStatus.latestSync?.startedAt ? formatDateTime(opsStatus.latestSync.startedAt) : "—"}</li>
              <li>Статус свежести: {opsStatus.syncHealth.description}</li>
              <li>SKU с неполной экономикой: {opsStatus.incompleteSkuCount > 0 ? <Link href="/skus?profitability=incomplete">{opsStatus.incompleteSkuCount}</Link> : "0"}</li>
            </ul>
          </article>

          <article className="panel">
            <div className="meta-row">
              <h2>Действия</h2>
              {isAdmin ? <StatusBadge label="Admin only" value="admin" /> : <StatusBadge label="Read only" value="info" />}
            </div>
            {isAdmin ? (
              <div className="button-row">
                <form action={runSyncAction}>
                  <SubmitButton pendingText="Синхронизируем...">{isDemoWorkspace ? "Обновить демо-данные" : "Запустить синхронизацию"}</SubmitButton>
                </form>
              </div>
            ) : (
              <p className="muted">Запуск sync доступен только администратору.</p>
            )}
            <p className="muted">Используйте повторную синхронизацию после изменения затрат, кассовых входных данных или при устаревших цифрах.</p>
            {latestRun ? (
              <div className={`alert ${latestRun.status === "FAILED" ? "alert--danger" : "alert--success"}`}>
                <strong>Последний запуск:</strong> {latestRun.status.toLowerCase()} · {formatDateTime(latestRun.startedAt)}
              </div>
            ) : null}
          </article>
        </section>

        <details className="timeline-card details-card">
          <summary className="details-card__summary">
            <div>
              <strong>Журнал задач синхронизации</strong>
              <p className="muted">Вторичный технический слой для ошибок, повторов и истории запусков.</p>
            </div>
            <StatusBadge label="Техдетали" value="info" />
          </summary>
          {syncRuns.length === 0 ? (
            <p className="muted">Задач ещё не было.</p>
          ) : (
            <div className="sync-list">
              {syncRuns.map((run) => (
                <article className="sync-item" key={run.id}>
                  <div className="sync-item__meta">
                    <StatusBadge value={run.status} />
                    <StatusBadge value={run.trigger} />
                    <span className="muted">{formatDateTime(run.startedAt)}</span>
                  </div>
                  <div className="muted">Период: {run.fromDate.toISOString().slice(0, 10)} — {run.toDate.toISOString().slice(0, 10)}</div>
                  {run.errorMessage ? <p className="text-danger">Ошибка: {humanizeSyncErrorMessage(run.errorMessage)}</p> : null}
                  {isAdmin && run.status === "FAILED" ? (
                    <form action={retrySyncRunAction.bind(null, run.id)}>
                      <SubmitButton pendingText="Повторяем..." variant="ghost">
                        Повторить этот sync
                      </SubmitButton>
                    </form>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </details>
      </section>

      <section className="section-stack">
        <div className="section-heading">
          <h2>Доступ</h2>
          <p className="muted">Пользователь, роль и приглашения в рабочее пространство.</p>
        </div>
        <section className="two-column">
          <article className="panel">
            <div className="meta-row">
              <h2>Сессия и роль</h2>
              {user ? <StatusBadge value={user.role} /> : null}
            </div>
            <ul className="info-list">
              <li>Пользователь: {user?.name}</li>
              <li>Эл. почта: {user?.email}</li>
              <li>Роль: {user ? <StatusBadge value={user.role} /> : null}</li>
              <li>Рабочее пространство: {user ? <StatusBadge value={user.workspaceKind} label={isDemoWorkspace ? "Демо-пространство" : "Рабочее пространство"} /> : null}</li>
              <li>Организация: {user?.organizationName}</li>
            </ul>
            {!isAdmin ? <p className="muted">Analyst работает с данными и SKU, но не управляет доступом, подключением и sync.</p> : null}
          </article>

          {isAdmin ? (
            <details className="panel panel--muted details-card">
              <summary className="details-card__summary">
                <div>
                  <strong>Invite-only доступ</strong>
                  <p className="muted">Создание и отзыв приглашений. Административный вторичный блок.</p>
                </div>
                <StatusBadge value="info" label="Admin" />
              </summary>
              <form action={createWorkspaceInviteAction} className="form-grid">
                <div className="field">
                  <label htmlFor="inviteEmail">Email</label>
                  <input id="inviteEmail" name="email" placeholder="analyst@company.ru" type="email" />
                  <p className="field-help">На этот адрес будет создана персональная ссылка для входа.</p>
                </div>
                <div className="field">
                  <label htmlFor="inviteRole">Роль</label>
                  <select defaultValue="ANALYST" id="inviteRole" name="role">
                    <option value="ANALYST">Analyst</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                  <p className="field-help">Admin управляет подключением и sync, Analyst работает с аналитикой и SKU.</p>
                </div>
                <div className="field field--full">
                  <SubmitButton pendingText="Создаём приглашение...">Создать приглашение</SubmitButton>
                </div>
              </form>
              {invites.length > 0 ? (
                <div className="sync-list">
                  {invites.map((invite) => (
                    <article className="sync-item" key={invite.id}>
                      <div className="sync-item__meta">
                        <StatusBadge value={invite.status.toLowerCase()} />
                        <StatusBadge value={invite.role} />
                      </div>
                      <strong>{invite.email}</strong>
                      <div className="muted">Ссылка: {`${env.appBaseUrl}/auth?invite=${invite.token}`}</div>
                      <div className="muted">Истекает: {invite.expiresAt ? formatDateTime(invite.expiresAt) : "—"}</div>
                      {invite.status === "PENDING" ? (
                        <form action={revokeWorkspaceInviteAction.bind(null, invite.id)}>
                          <SubmitButton pendingText="Отзываем..." variant="ghost">
                            Отозвать приглашение
                          </SubmitButton>
                        </form>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">Приглашений пока нет.</p>
              )}
            </details>
          ) : null}
        </section>
      </section>

      {isAdmin ? (
        <details className="section-stack details-card panel panel--muted" open={isDemoWorkspace}>
          <summary className="details-card__summary">
            <div>
              <strong>Demo mode</strong>
              <p className="muted">Вторичный режим для переключения пространства и демо-сценариев.</p>
            </div>
            <StatusBadge value="info" label="Служебно" />
          </summary>
          <section className="two-column">
            <article className="panel panel--muted">
              <div className="meta-row">
                <h2>Режим пространства</h2>
                <StatusBadge value="info" label="Служебно" />
              </div>
              <p className="muted">Переключение между рабочим и demo-пространством доступно только администратору.</p>
              <div className="button-row">
                <form action={switchWorkspaceAction.bind(null, "live")}>
                  <SubmitButton pendingText="Переключаем..." variant={isDemoWorkspace ? "ghost" : "secondary"}>
                    Открыть рабочее пространство
                  </SubmitButton>
                </form>
                {env.authAllowDemoLogin ? (
                  <form action={switchWorkspaceAction.bind(null, "demo")}>
                    <SubmitButton pendingText="Переключаем..." variant={isDemoWorkspace ? "secondary" : "ghost"}>
                      Открыть demo-пространство
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
            </article>

            <article className="panel">
              <div className="meta-row">
                <h2>{isDemoWorkspace ? "Сценарии демо" : "Помощь по sync"}</h2>
                {isDemoWorkspace && demoState ? <StatusBadge value="demo" label={`Активен: ${demoState.currentScenario.label}`} /> : <StatusBadge value="info" label="Recovery" />}
              </div>
              {isDemoWorkspace && demoState ? (
                <div className="scenario-grid">
                  {demoState.scenarios.map((scenario) => {
                    const isActive = scenario.key === demoState.currentScenario.key;

                    return (
                      <article className={`scenario-card ${isActive ? "scenario-card--active" : ""}`} key={scenario.key}>
                        <strong>{scenario.label}</strong>
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
              ) : (
                <ul className="info-list">
                  <li>Если sync упал, сначала проверьте токен и последнее сообщение об ошибке.</li>
                  <li>Если данные устарели, запустите sync повторно из этого экрана.</li>
                  <li>Если расчёты спорные, сначала проверьте SKU с неполной экономикой.</li>
                </ul>
              )}
            </article>
          </section>
        </details>
      ) : null}
    </main>
  );
}
