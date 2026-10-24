import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, CalendarDays, CheckCircle2, Clock3, Plus } from "lucide-react";
import { getProject } from "@/lib/data/projects";
import { officeNow, projectFieldSummary } from "@/lib/data/appointments";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AppointmentTable } from "@/components/scheduling/appointment-table";
import { StatTile } from "@/components/scheduling/stat-tile";
import { formatHours, splitUpcoming } from "@/lib/scheduling/calc";
import { APPOINTMENT_TYPE_LABEL } from "@/lib/scheduling/types";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

/**
 * A project's Scheduling tab: the meetings, inspections and other field work
 * booked for it, and the hours they took. Visits booked on a Service Proposal
 * that later became this project are here too, labelled as such — the
 * measuring visit before the contract is part of the job's history.
 */
export default async function ProjectSchedulingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const now = officeNow();
  const [t, { summary, appointments }] = await Promise.all([getServerT(), projectFieldSummary(id, now)]);
  const { upcoming, past } = splitUpcoming(appointments, now);
  const types = summary.byType.filter((r) => r.count > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          icon={Clock3}
          label={t("Field work hours")}
          value={formatHours(summary.completedHours)}
          hint={t("Completed visits and meetings")}
        />
        <StatTile icon={CheckCircle2} label={t("Completed")} value={String(summary.completedCount)} />
        <StatTile icon={CalendarDays} label={t("Upcoming")} value={String(summary.upcomingCount)} />
      </div>

      {types.length > 0 ? (
        <Card>
          <CardHeader title={t("Hours by type")} />
          <CardBody>
            <table className="w-full max-w-md text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="pb-1.5 font-medium">{t("Type")}</th>
                  <th className="pb-1.5 text-right font-medium">{t("Visits")}</th>
                  <th className="pb-1.5 text-right font-medium">{t("Hours")}</th>
                </tr>
              </thead>
              <tbody>
                {types.map((r) => (
                  <tr key={r.type} className="zebra-row border-b border-border/60 last:border-0">
                    <td className="py-1.5 text-fg">{t(APPOINTMENT_TYPE_LABEL[r.type])}</td>
                    <td className="py-1.5 text-right tabular-nums text-muted">{r.count}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-fg">{formatHours(r.hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title={t("Upcoming")}
          subtitle={t("Meetings, inspections, measuring and supervision visits booked for this project.")}
          action={
            <Link
              href={`/scheduling/new?project=${encodeURIComponent(id)}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              {t("Schedule visit")}
            </Link>
          }
        />
        <CardBody>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CalendarCheck className="h-8 w-8 text-faint" />
              <p className="mt-3 text-sm font-medium text-fg">{t("Nothing scheduled for this project.")}</p>
            </div>
          ) : (
            <AppointmentTable appointments={upcoming} t={t} now={now} projectId={id} showLink={false} />
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("History")}
          subtitle={
            summary.cancelledCount > 0
              ? fmt(t("Completed and past visits. {count} cancelled."), { count: summary.cancelledCount })
              : t("Completed and past visits.")
          }
        />
        <CardBody>
          {past.length === 0 ? (
            <p className="text-sm text-muted">{t("No field work recorded yet.")}</p>
          ) : (
            <AppointmentTable appointments={past} t={t} now={now} projectId={id} showLink={false} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
