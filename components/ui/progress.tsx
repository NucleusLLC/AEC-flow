import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const tone =
    pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-blue-500" : "bg-amber-500";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-gray-100", className)}>
      <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}
