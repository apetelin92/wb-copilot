import { StatusBadge } from "@/components/status-badge";

type StatusSummaryBlockProps = {
  tone: "success" | "warning" | "danger" | "info";
  badgeLabel: string;
  title: string;
  reason: string;
  action: string;
  meta?: Array<{ label: string; value: string }>;
  reasonLabel?: string;
  actionLabel?: string;
};

export function StatusSummaryBlock({
  tone,
  badgeLabel,
  title,
  reason,
  action,
  meta = [],
  reasonLabel = "Причина",
  actionLabel = "Что сделать"
}: StatusSummaryBlockProps) {
  return (
    <section className={`status-summary-block status-summary-block--${tone}`}>
      <div className="meta-row">
        <StatusBadge value={tone} label={badgeLabel} />
      </div>
      <h2>{title}</h2>
      <div className="status-summary-block__content">
        <article>
          <span>{reasonLabel}</span>
          <strong>{reason}</strong>
        </article>
        <article>
          <span>{actionLabel}</span>
          <strong>{action}</strong>
        </article>
      </div>
      {meta.length > 0 ? (
        <div className="status-summary-block__meta">
          {meta.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
