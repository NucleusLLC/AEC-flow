import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function StatTile({
  label,
  value,
  sub,
  href,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const inner = (
    <div className="card-surface h-full rounded-xl border border-border bg-surface p-4 transition-colors group-hover:border-brand/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-muted">
          {Icon ? <Icon className="h-4 w-4" /> : null}
          {label}
        </div>
        {href ? <ArrowUpRight className="h-4 w-4 text-muted group-hover:text-brand" /> : null}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums text-fg">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted">{sub}</div> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="group block">
      {inner}
    </Link>
  ) : (
    <div className="group">{inner}</div>
  );
}

export function StatSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}
