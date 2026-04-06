import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";

type RiskBannerProps = {
  tone: "success" | "warning" | "danger";
  title: string;
  description: string;
  meta?: Array<{ label: string; value: string }>;
  href?: string;
  ctaLabel?: string;
};

export function RiskBanner({ tone, title, description, meta = [], href, ctaLabel }: RiskBannerProps) {
  return (
    <section className={`risk-banner risk-banner--${tone}`}>
      <div className="meta-row">
        <strong>{title}</strong>
        <StatusBadge value={tone} />
      </div>
      <p>{description}</p>
      {meta.length > 0 ? (
        <div className="risk-banner__meta">
          {meta.map((item) => (
            <div className="risk-banner__meta-item" key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      ) : null}
      {href && ctaLabel ? (
        <div className="button-row">
          <Link className="button button--ghost" href={href}>
            {ctaLabel}
          </Link>
        </div>
      ) : null}
    </section>
  );
}
