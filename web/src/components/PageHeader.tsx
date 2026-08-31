import type { ReactNode } from 'react';

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-[1.75rem] border border-brand-100 bg-white px-5 py-6 shadow-card dark:border-slate-800 dark:bg-slate-900 sm:px-7 sm:py-8">
      <span aria-hidden className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-gold-300/20 blur-3xl dark:bg-gold-400/10" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow && <p className="page-kicker">{eyebrow}</p>}
          <h1 className={`${eyebrow ? 'mt-2' : ''} page-title`}>{title}</h1>
          {description && <div className="page-description mt-2">{description}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
