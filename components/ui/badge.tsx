import { cn } from "@/lib/utils";

type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-gray-100 text-gray-700 ring-gray-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const statusTone: Record<string, Tone> = {
  ACTIVE: "green",
  ON_HOLD: "amber",
  COMPLETED: "blue",
  CANCELLED: "slate",
};

const priorityTone: Record<string, Tone> = {
  LOW: "slate",
  MEDIUM: "blue",
  HIGH: "amber",
  CRITICAL: "red",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={statusTone[status] ?? "neutral"}>
      {status.replace(/_/g, " ").toLowerCase()}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={priorityTone[priority] ?? "neutral"}>{priority.toLowerCase()}</Badge>;
}
