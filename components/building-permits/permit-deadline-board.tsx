/**
 * PERMIT DEADLINES on the dashboards: every open deadline set on a permit file
 * (the DEADLINE button on the case file), soonest first. Yellow more than 14
 * days out, red inside 14, blinking red inside 3 and once overdue
 * (lib/building-permits/deadlines.ts). Each row opens the permit's deadlines,
 * where MET takes it off this list.
 *
 * Renders nothing when there are none, so a dashboard without deadlines looks
 * exactly as it did before.
 */
import Link from "next/link";
import { ArrowUpRight, Siren } from "lucide-react";
import { DeadlineChip } from "@/components/building-permits/deadline-chip";
import { militaryDate } from "@/lib/building-permits/register";
import {
  deadlineLabel,
  deadlineState,
  PERMIT_DEADLINE_KIND_LABEL,
  type OpenPermitDeadline,
} from "@/lib/building-permits/deadlines";

export function PermitDeadlineBoard({
  deadlines,
  today,
  t,
}: {
  deadlines: OpenPermitDeadline[];
  today: string;
  t: (s: string) => string;
}) {
  if (deadlines.length === 0) return null;
  const states = deadlines.map((d) => deadlineState(d.dueDate, today));
  const blinking = states.includes("BLINK");
  const red = blinking || states.includes("RED");

  return (
    <section
      aria-label={t("PERMIT DEADLINES")}
      role="status"
      className={`card-surface rounded-xl border-2 bg-surface p-4 ${
        red ? "border-red-600/80" : "border-yellow-500/80"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={red ? "text-red-600" : "text-yellow-500"}>
          <span className={`reminder-light ${blinking ? "reminder-light--fast" : ""}`} aria-hidden />
        </span>
        <h2 className="inline-flex items-center gap-1.5 text-sm font-bold uppercase tracking-widest text-fg">
          <Siren className="h-4 w-4" /> {t("PERMIT DEADLINES")}
        </h2>
        <span className="ml-auto font-mono text-[11px] font-semibold text-muted">{deadlines.length}</span>
      </div>
      <ul className="divide-y divide-border/60">
        {deadlines.map((d, i) => (
          <li key={d.id} data-deadline-state={states[i]}>
            <Link
              href={`/design/building-permits/${d.permitId}#deadlines`}
              className={`group flex items-center gap-3 py-2.5 transition-colors hover:bg-surface-2 ${
                states[i] === "BLINK" ? "bg-red-500/5" : ""
              }`}
            >
              <DeadlineChip dueDate={d.dueDate} today={today} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold uppercase tracking-wide text-fg">
                  {d.kind === "OTHER" ? deadlineLabel(d) : t(PERMIT_DEADLINE_KIND_LABEL[d.kind])}
                </span>
                <span className="block truncate text-[11px] text-faint">
                  <span className="font-mono">{d.permitNumber ?? d.reference}</span> · {d.title}
                  {d.authority ? ` — ${d.authority}` : ""}
                </span>
              </span>
              <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-fg">{militaryDate(d.dueDate)}</span>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-muted group-hover:text-brand" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
