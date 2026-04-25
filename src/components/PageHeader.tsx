import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={`page-header ${className ?? ""}`.trim()}>
      <div className="page-header-copy">
        <h2 className="page-header-title">{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="page-header-actions">{actions}</div>
    </div>
  );
}
