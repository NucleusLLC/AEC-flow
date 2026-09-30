/**
 * The dashboard's blinking reminder for permit revision deadlines.
 *
 * One row per permit whose deadline is inside its warning window
 * (listRevisionReminders), most urgent first. Amber lamps blink for an upcoming
 * deadline; red lamps blink faster on the day and after it. Each row opens the
 * case file, where recording the new version switches the reminder off.
 *
 * Renders nothing when nothing is due, so a dashboard with no deadlines looks
 * exactly as it did before.
 */
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { militaryDate } from "@/lib/building-permits/register";
import type { PermitRevisionReminder } from "@/lib/building-permits/revision-reminder";
import { fmt } from "@/lib/i18n/format";

function when(r: PermitRevisionReminder, t: (s: string) => string): string {
  if (r.state === "today") return t("Revision due today");
  if (r.state === "overdue") {
    const days = -r.daysLeft;
    return days === 1 ? t("Revision 1 day overdue") : fmt(t("Revision {days} days overdue"), { days });
  }
  return r.daysLeft === 1 ? t("Revision due tomorrow") : fmt(t("Revision due in {days} days"), { days: r.daysLeft });
}

export function RevisionReminders({
  reminders,
  t,
}: {
  reminders: PermitRevisionReminder[];
  t: (s: string) => string;
}) {
  if (reminders.length === 0) return null;
  const urgent = reminders.some((r) => r.state !== "upcoming");

  return (
    <section
      aria-label={t("Building permit revision reminders")}
      role="status"
      className={`card-surface rounded-xl border-2 bg-surface p-4 ${
        urgent ? "border-red-500/70" : "border-amber-500/70"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className={urgent ? "text-red-500" : "text-amber-500"}>
          <span className={`reminder-light ${urgent ? "reminder-light--fast" : ""}`} aria-hidden />
        </span>
        <h2 className="text-sm font-semibold text-fg">{t("Building permit revisions due")}</h2>
        <span className={urgent ? "text-red-500" : "text-amber-500"}>
          <span className={`reminder-light ${urgent ? "reminder-light--fast" : ""}`} aria-hidden />
        </span>
      </div>
      <ul className="divide-y divide-border/60">
        {reminders.map((r) => {
          const hot = r.state !== "upcoming";
          return (
            <li key={r.permitId}>
              <Link
                href={`/design/building-permits/${r.permitId}`}
                className="group flex items-center gap-3 py-2.5 transition-colors hover:bg-surface-2"
              >
                <span className={hot ? "text-red-500" : "text-amber-500"}>
                  <span className={`reminder-light ${hot ? "reminder-light--fast" : ""}`} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    <span className="font-mono">{r.reference}</span> · {r.title}
                  </span>
                  <span className="block truncate text-[11px] text-faint">
                    {[r.authority, r.note].filter(Boolean).join(" — ") || t("Submit the revised version")}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block text-xs font-semibold ${hot ? "text-red-600" : "text-amber-700 dark:text-amber-400"}`}>
                    {when(r, t)}
                  </span>
                  <span className="block font-mono text-[11px] text-muted">{militaryDate(r.dueAt)}</span>
                </span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted group-hover:text-brand" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
