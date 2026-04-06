import Link from "next/link";
import { type ReactNode } from "react";

import { logoutAction } from "@/app/actions";
import { SidebarNavLink } from "@/components/sidebar-nav-link";
import { StatusBadge } from "@/components/status-badge";
import { WorkspaceTrustBar } from "@/components/workspace-trust-bar";
import { WorkspaceTopNav } from "@/components/workspace-top-nav";
import { formatDateTime } from "@/lib/format";
import { getWorkspaceOperationalStatus } from "@/server/modules/ops-status/service";

type AppShellProps = {
  user: {
    organizationId: string;
    organizationName: string;
    workspaceKind: "demo" | "live";
  };
  children: ReactNode;
};

type NavigationItem = {
  href: string;
  label: string;
  badge?: string;
  secondary?: boolean;
};

const primaryNavigation: NavigationItem[] = [
  { href: "/dashboard", label: "Сегодня" },
  { href: "/skus", label: "SKU" },
  { href: "/cash-gap", label: "Касса" },
  { href: "/calculator", label: "Калькулятор" },
  { href: "/brief", label: "Бриф" }
];

const secondaryNavigation: NavigationItem[] = [
  { href: "/onboarding", label: "Онбординг", secondary: true },
  { href: "/settings", label: "Настройки", secondary: true },
  { href: "/abc-analysis", label: "ABC", badge: "Бета", secondary: true },
  { href: "/supply", label: "Поставки", badge: "Бета", secondary: true }
];

export async function AppShell({ user, children }: AppShellProps) {
  const operationalStatus = await getWorkspaceOperationalStatus({ organizationId: user.organizationId });

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Перейти к содержимому
      </a>
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__eyebrow">MarginPoint</span>
          <strong>Ежедневная прибыль и касса</strong>
          <span className="sidebar__workspace-caption">{user.organizationName}</span>
        </div>
        <div className="sidebar__workspace-card">
          <div className="sidebar__workspace-meta">
            <StatusBadge label={user.workspaceKind === "demo" ? "Демо-пространство" : "Рабочее пространство"} value={user.workspaceKind} />
            <StatusBadge label={operationalStatus.syncHealth.label} value={operationalStatus.syncHealth.tone} />
          </div>
          <p>
            {operationalStatus.latestCompletedSync?.startedAt
              ? `Последний sync: ${formatDateTime(operationalStatus.latestCompletedSync.startedAt)}`
              : "Ещё не было завершённой синхронизации"}
          </p>
          <div className="sidebar__workspace-actions">
            <Link className="sidebar__workspace-link" href="/settings">
              Проверить доступ и sync
            </Link>
            <Link className="sidebar__workspace-link" href="/onboarding">
              Открыть маршрут запуска
            </Link>
          </div>
        </div>
        <nav aria-label="Основной маршрут" className="sidebar__section">
          <span className="sidebar__section-title">Основной маршрут</span>
          <div className="sidebar__nav">
            {primaryNavigation.map((item) => (
              <SidebarNavLink badge={item.badge} href={item.href} key={item.href} label={item.label} secondary={item.secondary} />
            ))}
          </div>
        </nav>
        <nav aria-label="Сервисные разделы" className="sidebar__section">
          <span className="sidebar__section-title">Настройка и сервис</span>
          <div className="sidebar__nav">
            {secondaryNavigation.map((item) => (
              <SidebarNavLink badge={item.badge} href={item.href} key={item.href} label={item.label} secondary={item.secondary} />
            ))}
          </div>
        </nav>
        <div className="sidebar__profile">
          <form action={logoutAction}>
            <button className="button button--ghost button--small" type="submit">
              Выйти
            </button>
          </form>
        </div>
      </aside>
      <div className="app-shell__content">
        <WorkspaceTopNav />
        <WorkspaceTrustBar
          organizationName={user.organizationName}
          incompleteSkuCount={operationalStatus.incompleteSkuCount}
          latestCompletedSyncAt={operationalStatus.latestCompletedSync?.startedAt}
          syncHealth={operationalStatus.syncHealth}
          workspaceKind={user.workspaceKind}
        />
        <div id="main-content">{children}</div>
      </div>
    </div>
  );
}
