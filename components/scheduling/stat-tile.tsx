import { Card, CardBody } from "@/components/ui/card";

/** One figure with its label: the tiles above the register and the project tab. */
export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="text-xs text-muted">{label}</div>
          <div className="text-lg font-semibold tabular-nums text-fg">{value}</div>
          {hint ? <div className="truncate text-[11px] text-faint">{hint}</div> : null}
        </div>
      </CardBody>
    </Card>
  );
}
