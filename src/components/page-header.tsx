import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  eyebrow?: string;
  badges?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({ title, description, actions, eyebrow, badges, meta }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__content">
        {eyebrow || badges ? (
          <div className="page-header__topline">
            {eyebrow ? <span className="page-header__eyebrow">{eyebrow}</span> : null}
            {badges ? <div className="page-header__badges">{badges}</div> : null}
          </div>
        ) : null}
        <h1>{title}</h1>
        <p>{description}</p>
        {meta ? <div className="page-header__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
