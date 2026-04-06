import Link from "next/link";
import { redirect } from "next/navigation";

import { acceptInviteAction, loginAction, loginDemoAction } from "@/app/actions";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { env } from "@/server/lib/env";
import { getCurrentSessionUser } from "@/server/modules/auth/session";
import { getInvitePreviewByToken } from "@/server/modules/auth/invite.service";
import { DEMO_ACCOUNT_EMAIL, LIVE_OWNER_EMAIL } from "@/server/modules/workspace/constants";

export const dynamic = "force-dynamic";

function getErrorText(error?: string) {
  if (!error) {
    return null;
  }

  const decoded = decodeURIComponent(error);
  const dictionary: Record<string, string> = {
    missing_email: "Укажите email для входа.",
    invite_required: "Вход разрешён только существующим пользователям или по приглашению.",
    invite_not_found: "Приглашение не найдено.",
    invite_not_active: "Приглашение уже недействительно или было использовано.",
    demo_disabled: "Демо-вход отключён в этом окружении."
  };

  return dictionary[decoded] ?? decoded;
}

export default async function AuthPage({ searchParams }: { searchParams?: { error?: string; invite?: string } }) {
  const user = await getCurrentSessionUser();

  if (user) {
    redirect("/");
  }

  const inviteToken = searchParams?.invite;
  const invitePreview = inviteToken ? await getInvitePreviewByToken(inviteToken) : null;
  const errorText = getErrorText(searchParams?.error);

  return (
    <div className="auth-layout">
      <section className="auth-card">
        <div className="auth-card__intro">
          <div className="auth-card__topline">
            <span className="sidebar__eyebrow">MarginPoint Access</span>
            <Link className="auth-link" href="/site">
              Открыть сайт
            </Link>
          </div>
          <h1>Invite-only вход для рабочей работы и безопасный demo-доступ</h1>
          <p>Рабочее пространство теперь доступно только существующим пользователям и приглашённым участникам. Демо-контур остаётся отдельным и безопасным для показов.</p>

          <div className="auth-metric-grid">
            <article className="auth-metric-card">
              <span>Рабочий доступ</span>
              <strong>Только по приглашению</strong>
              <p>Новые аналитики попадают в рабочее пространство только после приглашения от администратора.</p>
            </article>
            <article className="auth-metric-card">
              <span>Роли</span>
              <strong>Admin / Analyst</strong>
              <p>Admin управляет доступом, подключением и sync. Analyst работает с SKU, кассой и расчётами.</p>
            </article>
            <article className="auth-metric-card">
              <span>Демо</span>
              <strong>{env.authAllowDemoLogin ? "Доступно" : "Отключено"}</strong>
              <p>Демо-режим можно оставить для показов или выключить в production окружении.</p>
            </article>
          </div>

          <div className="auth-account-grid">
            <article className="auth-account-card auth-account-card--live">
              <span className="workspace-chip workspace-chip--live">Bootstrap admin</span>
              <strong>{LIVE_OWNER_EMAIL}</strong>
              <p>Этот адрес остаётся базовым администратором рабочего пространства и может приглашать новых пользователей.</p>
            </article>
            <article className="auth-account-card auth-account-card--demo">
              <span className="workspace-chip workspace-chip--demo">Демо-аккаунт</span>
              <strong>{DEMO_ACCOUNT_EMAIL}</strong>
              <p>Используйте только для показов, тестов и переключения готовых сценариев.</p>
            </article>
          </div>
        </div>

        <div className="auth-card__form">
          <div className="auth-form-header">
            <span className="sidebar__eyebrow">Вход</span>
            <h2>Рабочий доступ и приглашения</h2>
            <p>Если у вас уже есть доступ, войдите по email. Если вам прислали приглашение, сначала примите его.</p>
          </div>

          {errorText ? <div className="alert alert--danger">{errorText}</div> : null}

          {inviteToken ? (
            invitePreview ? (
              <div className="auth-section-card auth-section-card--live">
                <div className="auth-section-card__header">
                  <span className="workspace-chip workspace-chip--live">Приглашение</span>
                  <StatusBadge label={invitePreview.status === "PENDING" ? "Активно" : invitePreview.status} value={invitePreview.status.toLowerCase()} />
                </div>
                <h3>Вас пригласили в {invitePreview.organizationName}</h3>
                <p>
                  Email: <strong>{invitePreview.email}</strong>
                  <br />
                  Роль: <strong>{invitePreview.role === "ADMIN" ? "Admin" : "Analyst"}</strong>
                </p>
                <form action={acceptInviteAction.bind(null, inviteToken)} className="auth-login-form">
                  <SubmitButton pendingText="Подключаем доступ...">Принять приглашение и войти</SubmitButton>
                </form>
              </div>
            ) : (
              <div className="alert alert--danger">Приглашение не найдено или уже недействительно.</div>
            )
          ) : null}

          <div className="auth-access-grid">
            <div className="auth-section-card auth-section-card--live">
              <div className="auth-section-card__header">
                <span className="workspace-chip workspace-chip--live">Рабочий вход</span>
                <span className="auth-inline-note">Для существующих пользователей</span>
              </div>
              <h3>Открыть рабочее пространство</h3>
              <p>Новые пользователи больше не создаются автоматически. Если доступа ещё нет, попросите администратора отправить приглашение.</p>
              <form action={loginAction} className="auth-login-form">
                <div className="field field--full">
                  <label htmlFor="email">Рабочая эл. почта</label>
                  <input defaultValue={LIVE_OWNER_EMAIL} id="email" name="email" placeholder="analyst@company.ru" type="email" />
                </div>
                <div className="field field--full">
                  <SubmitButton pendingText="Открываем доступ...">Войти</SubmitButton>
                </div>
              </form>
            </div>

            <div className="auth-section-card auth-section-card--demo">
              <div className="auth-section-card__header">
                <span className="workspace-chip workspace-chip--demo">Демо-вход</span>
                <span className="auth-inline-note">Для показов</span>
              </div>
              <h3>Открыть demo workspace</h3>
              <p>{env.authAllowDemoLogin ? "Демо-пространство изолировано от рабочего контура и подходит для безопасных показов продукта." : "В этом окружении demo-вход отключён, чтобы исключить нерабочие обходные сценарии."}</p>
              {env.authAllowDemoLogin ? (
                <form action={loginDemoAction} className="auth-login-form">
                  <div className="field field--full">
                    <SubmitButton pendingText="Открываем demo..." variant="secondary">
                      Войти в demo
                    </SubmitButton>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
