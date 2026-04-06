import Link from "next/link";

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

export function EmptyState({ title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <div className="empty-state__icon">∅</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {actionLabel && actionHref ? (
        <Link className="button button--primary" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </section>
  );
}
