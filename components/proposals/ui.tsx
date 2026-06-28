/**
 * Shared visual language for the Proposals area — used across the detail page
 * and the editor so every panel reads as one coherent system:
 *   • black, bold section titles with a brand accent bar
 *   • tight, consistent header padding
 *
 * Greg's "Go Military" direction: minimalist, high-contrast, black bold headers.
 */

import type { ReactNode } from "react";

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-1 h-4 w-1 shrink-0 rounded-full bg-brand" aria-hidden />
        <div>
          <h3 className="text-[15px] font-bold leading-tight tracking-tight text-fg">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-xs font-medium text-muted">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Page-level heading, used at the top of each proposal screen. */
export function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-2xl font-bold tracking-tight text-fg">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}
