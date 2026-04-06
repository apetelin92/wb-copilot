import Link from "next/link";
import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "danger" | "warning";
  footer?: ReactNode;
  href?: string;
  isActive?: boolean;
};

export function StatCard({ label, value, hint, tone = "default", footer, href, isActive = false }: StatCardProps) {
  const className = `stat-card stat-card--${tone}${href ? " stat-card--interactive" : ""}${isActive ? " stat-card--active" : ""}`;
  const content = (
    <>
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">{value}</strong>
      {hint ? <p className="stat-card__hint">{hint}</p> : null}
      {footer ? <div className="stat-card__footer">{footer}</div> : null}
    </>
  );

  if (href) {
    return (
      <Link aria-current={isActive ? "page" : undefined} className={className} href={href}>
        {content}
      </Link>
    );
  }

  return <article className={className}>{content}</article>;
}
