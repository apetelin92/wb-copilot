import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";

type ActionSummaryCardProps = {
  title: string;
  summary: string;
  risks: string[];
  actions: Array<{
    label: string;
    href: string;
    description?: string;
  }>;
  primaryHref?: string;
  primaryLabel?: string;
};

export function ActionSummaryCard({ title, summary, risks, actions, primaryHref, primaryLabel }: ActionSummaryCardProps) {
  return (
    <section className="action-summary-card">
      <div className="meta-row">
        <StatusBadge value="info" label="Что важно сегодня" />
      </div>
      <h2>{title}</h2>
      <p>{summary}</p>
      <div className="action-summary-card__grid">
        <div>
          <strong>Главные риски</strong>
          <ul className="action-summary-card__list">
            {risks.length > 0 ? risks.map((risk) => <li key={risk}>{risk}</li>) : <li>Критичных рисков на сегодня не выявлено.</li>}
          </ul>
        </div>
        <div>
          <strong>Что сделать</strong>
          <div className="action-summary-card__actions">
            {actions.map((action) => (
              <Link className="action-summary-card__action" href={action.href} key={action.label}>
                <strong>{action.label}</strong>
                {action.description ? <span>{action.description}</span> : null}
              </Link>
            ))}
          </div>
        </div>
      </div>
      {primaryHref && primaryLabel ? (
        <div className="button-row">
          <Link className="button button--primary" href={primaryHref}>
            {primaryLabel}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
