import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/format";

type WorkspaceTrustBarProps = {
  workspaceKind: "demo" | "live";
  organizationName: string;
  latestCompletedSyncAt?: Date | null;
  incompleteSkuCount: number;
  syncHealth: {
    tone: "success" | "warning" | "danger";
    label: string;
    description: string;
  };
};

export function WorkspaceTrustBar({ workspaceKind, organizationName, latestCompletedSyncAt, incompleteSkuCount, syncHealth }: WorkspaceTrustBarProps) {
  return (
    <section className={`workspace-trust-bar workspace-trust-bar--${syncHealth.tone}`}>
      <div className="workspace-trust-bar__main">
        <div className="meta-row">
          <StatusBadge label={workspaceKind === "demo" ? "Демо-пространство" : "Рабочее пространство"} value={workspaceKind} />
          <StatusBadge label={syncHealth.label} value={syncHealth.tone} />
          {latestCompletedSyncAt ? <span className="muted">Последнее обновление: {formatDateTime(latestCompletedSyncAt)}</span> : null}
        </div>
        <p>
          {workspaceKind === "demo"
            ? `${organizationName}: здесь доступны демо-данные и переключение демо-сценариев.`
            : `${organizationName}: это рабочее пространство для реального кабинета WB. Демо-сценарии доступны только в demo workspace.`}
        </p>
      </div>
      <div className="workspace-trust-bar__actions">
        <Link className="workspace-trust-bar__link" href="/settings">
          Открыть режим и sync
        </Link>
        {incompleteSkuCount > 0 ? (
          <Link className="workspace-trust-bar__link" href="/skus?profitability=incomplete">
            Неполные SKU: {incompleteSkuCount}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
