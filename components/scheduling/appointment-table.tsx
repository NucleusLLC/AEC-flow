import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AppointmentStatusBadge, AppointmentTypeBadge } from "@/components/scheduling/badges";
import { militaryDate } from "@/lib/building-permits/register";
import { awaitingCompletion, effectiveHours, formatHours } from "@/lib/scheduling/calc";
import type { AppointmentDTO } from "@/lib/scheduling/types";
import { fmt } from "@/lib/i18n/format";

/**
 * One register of appointments, shared by /scheduling, a project's Scheduling
 * tab and the Service Proposal card, so the three cannot disagree about what a
 * row says.
 *
 * `projectId` is set on a project's tab: a visit whose own project is not this
 * one reached the tab through a proposal later converted into it, and says so.
 */
export function AppointmentTable({
  appointments,
  t,
  now,
  projectId,
  showLink = true,
  showDate = true,
}: {
  appointments: AppointmentDTO[];
  t: (text: string) => string;
  now: Date;
  projectId?: string;
  showLink?: boolean;
  showDate?: boolean;
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
            <th className="px-4 pb-1.5 font-medium">{showDate ? t("Date") : t("Time slot")}</th>
            <th className="px-3 pb-1.5 font-medium">{t("Type")}</th>
            <th className="px-3 pb-1.5 font-medium">{t("Appointment")}</th>
            {showLink ? <th className="px-3 pb-1.5 font-medium">{t("Linked to")}</th> : null}
            <th className="px-3 pb-1.5 font-medium">{t("Attendees")}</th>
            <th className="px-3 pb-1.5 text-right font-medium">{t("Hours")}</th>
            <th className="px-4 pb-1.5 font-medium">{t("Status")}</th>
          </tr>
        </thead>
        <tbody>
          {appointments.map((a) => {
            const viaProposal = Boolean(projectId && a.projectId !== projectId && a.proposalNumber);
            const hours = a.status === "COMPLETED" ? effectiveHours(a) : a.plannedHours;
            const late = awaitingCompletion(a, now);
            return (
              <tr
                key={a.id}
                className="zebra-row border-b border-border/60 transition-colors last:border-0 zebra-hover"
              >
                <td className="whitespace-nowrap px-4 py-2.5 align-top font-mono text-xs tabular-nums text-muted">
                  {showDate ? <div className="text-fg">{militaryDate(a.date)}</div> : null}
                  <div>
                    {a.startTime}–{a.endTime}
                  </div>
                </td>
                <td className="px-3 py-2.5 align-top">
                  <AppointmentTypeBadge type={a.type} />
                </td>
                <td className="px-3 py-2.5 align-top">
                  <Link href={`/scheduling/${a.id}`} className="font-medium text-brand hover:underline">
                    {a.title}
                  </Link>
                  <div className="font-mono text-[11px] text-faint">
                    {a.number}
                    {a.location ? ` · ${a.location}` : ""}
                  </div>
                  {viaProposal ? (
                    <div className="mt-0.5 text-[11px] text-amber-700">
                      {fmt(t("booked on proposal {number}"), { number: a.proposalNumber ?? "" })}
                    </div>
                  ) : null}
                </td>
                {showLink ? (
                  <td className="px-3 py-2.5 align-top text-muted">
                    {a.projectId ? (
                      <Link href={`/projects/${a.projectId}/scheduling`} className="block truncate hover:text-fg">
                        {a.projectName}
                      </Link>
                    ) : null}
                    {a.serviceProposalId ? (
                      <Link
                        href={`/design/service-proposals/${a.serviceProposalId}`}
                        className="block truncate font-mono text-[11px] hover:text-fg"
                      >
                        {a.proposalNumber}
                      </Link>
                    ) : null}
                    {a.clientName ? <div className="truncate text-[11px] text-faint">{a.clientName}</div> : null}
                  </td>
                ) : null}
                <td className="px-3 py-2.5 align-top text-muted">
                  <div className="max-w-[220px] truncate" title={a.attendeeNames.join(", ")}>
                    {a.attendeeNames.length ? a.attendeeNames.join(", ") : "—"}
                  </div>
                  {a.externalAttendees ? (
                    <div className="max-w-[220px] truncate text-[11px] text-faint" title={a.externalAttendees}>
                      + {a.externalAttendees}
                    </div>
                  ) : null}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right align-top font-mono text-xs tabular-nums">
                  {a.status === "CANCELLED" ? (
                    <span className="text-faint">—</span>
                  ) : (
                    <span className={a.status === "COMPLETED" ? "font-semibold text-fg" : "text-muted"}>
                      {formatHours(hours)}
                    </span>
                  )}
                  {a.status !== "COMPLETED" && a.status !== "CANCELLED" ? (
                    <div className="text-[10px] text-faint">{t("planned")}</div>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 align-top">
                  <AppointmentStatusBadge status={a.status} />
                  {late ? (
                    <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-700">
                      <AlertTriangle className="h-3 w-3" />
                      {t("To complete")}
                    </div>
                  ) : null}
                  {a.timeLoggedAt ? (
                    <div className="mt-1 text-[10px] text-faint">{t("On timesheets")}</div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
