import Link from "next/link";
import { Plus } from "lucide-react";
import { listAppointmentsForProposal, officeNow } from "@/lib/data/appointments";
import { AppointmentStatusBadge } from "@/components/scheduling/badges";
import { militaryDate } from "@/lib/building-permits/register";
import { effectiveHours, formatHours, summarize } from "@/lib/scheduling/calc";
import { APPOINTMENT_TYPE_LABEL } from "@/lib/scheduling/types";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

/**
 * The visits booked on a Service Proposal — the measuring visit or the first
 * meeting before there is a project — in the proposal page's side column.
 * Server component; it reads its own data so the page only places it.
 */
export async function ProposalSchedulingCard({ proposalId }: { proposalId: string }) {
  const [t, appointments] = await Promise.all([getServerT(), listAppointmentsForProposal(proposalId)]);
  const now = officeNow();
  const summary = summarize(appointments, now);
  const recent = [...appointments].sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 8);

  return (
    <div className="card-surface rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg">{t("Scheduling")}</h3>
        <Link
          href={`/scheduling/new?proposal=${encodeURIComponent(proposalId)}`}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-border px-2 text-xs font-medium text-muted hover:border-brand hover:text-fg"
        >
          <Plus className="h-3.5 w-3.5" /> {t("Schedule visit")}
        </Link>
      </div>
      {appointments.length === 0 ? (
        <p className="mt-2 text-xs text-muted">{t("No meetings or visits booked on this proposal.")}</p>
      ) : (
        <>
          <ul className="zebra-list mt-2 space-y-2 text-sm">
            {recent.map((a) => (
              <li key={a.id} className="min-w-0">
                <Link href={`/scheduling/${a.id}`} className="block truncate font-medium text-brand hover:underline">
                  {a.title}
                </Link>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                  <span className="font-mono">
                    {militaryDate(a.date)} {a.startTime}
                  </span>
                  <span>{t(APPOINTMENT_TYPE_LABEL[a.type])}</span>
                  {a.status === "COMPLETED" ? (
                    <span className="font-mono">{formatHours(effectiveHours(a))}</span>
                  ) : null}
                  <AppointmentStatusBadge status={a.status} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 border-t border-border pt-2 text-xs text-muted">
            {fmt(t("{count} completed · {hours}"), {
              count: summary.completedCount,
              hours: formatHours(summary.completedHours),
            })}
          </p>
        </>
      )}
    </div>
  );
}
