import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        // `card-surface` carries no styling of its own — it is a hook so a page
        // can restyle every card it owns (the dashboard's glass background) from
        // one scoped rule instead of threading a prop through every call site.
        //
        // It is also the OPT-IN for that glass, and the handful of page-level
        // panels that cannot faithfully be a <Card> (a <Link> tile, an <li>, a
        // bordered table wrapper) carry the class directly for that reason. Two
        // rules travel with it: never on a control, a menu or a dialog, and
        // never on something already inside a glass surface. The reasoning is in
        // the "WHAT IS GLASS AND WHAT IS NOT" note in app/globals.css.
        "card-surface rounded-[var(--radius-card)] border border-border bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}
