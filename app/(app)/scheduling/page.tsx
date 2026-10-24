import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CalendarDays, Clock3, Plus } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { AppointmentTable } from "@/components/scheduling/appointment-table";
import { StatTile } from "@/components/scheduling/stat-tile";
import { listAppointments, officeNow } from "@/lib/data/appointments";
import { groupByDay, registerTiles, splitUpcoming, formatHours } from "@/lib/scheduling/calc";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABEL,
  APPOINTMENT_TYPES,
  APPOINTMENT_TYPE_LABEL,
  type AppointmentStatus,
  type AppointmentType,
} from "@/lib/scheduling/types";
import { militaryDate } from "@/lib/building-permits/register";
import { getServerT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Scheduling · AEC-flow" };

const CHIP = "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors";

/**
 * The practice's diary of meetings and field work: what is coming up, by day,
 * and what has happened. Filters are links (?type=, ?status=) so a filtered
 * view can be bookmarked and the page stays a server component.
 */
export default async function SchedulingPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const type = APPOINTMENT_TYPES.includes(sp.type as AppointmentType) ? (sp.type as AppointmentType) : undefined;
  const status = APPOINTMENT_STATUSES.includes(sp.status as AppointmentStatus)
    ? (sp.status as AppointmentStatus)
    : undefined;

  const [t, all] = await Promise.all([getServerT(), listAppointments()]);
  const now = officeNow();
  const tiles = registerTiles(all, now);
  const shown = all.filter((a) => (!type || a.type === type) && (!status || a.status === status));
  const { upcoming, past } = splitUpcoming(shown, now);
  const days = groupByDay(upcoming);

  const href = (next: { type?: string; status?: string }) => {
    const q = new URLSearchParams();
    const ty = "type" in next ? next.type : type;
    const st = "status" in next ? next.status : status;
    if (ty) q.set("type", ty);
    if (st) q.set("status", st);
    const s = q.toString();
    return s ? `/scheduling?${s}` : "/scheduling";
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("Scheduling")}</h2>
          <p className="text-sm text-muted">
            {t("Meetings, inspections, measuring, supervision and other field work, booked for a project or a potential project.")}
          </p>
        </div>
        <Link
          href="/scheduling/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" /> {t("New appointment")}
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile icon={CalendarDays} label={t("This week")} value={String(tiles.thisWeek)} />
        <StatTile icon={CalendarCheck} label={t("Upcoming")} value={String(tiles.upcoming)} />
        <StatTile icon={Clock3} label={t("Hours this month")} value={formatHours(tiles.hoursThisMonth)} />
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-label={t("Filter")}>
        <Link href={href({ type: undefined })} className={cn(CHIP, !type ? "border-brand bg-brand text-brand-fg" : "border-border text-muted hover:bg-surface-2")}>
          {t("All types")}
        </Link>
        {APPOINTMENT_TYPES.map((k) => (
          <Link
            key={k}
            href={href({ type: k })}
            className={cn(CHIP, type === k ? "border-brand bg-brand text-brand-fg" : "border-border text-muted hover:bg-surface-2")}
          >
            {t(APPOINTMENT_TYPE_LABEL[k])}
          </Link>
        ))}
        <span className="mx-1 h-5 w-px bg-border" />
        <Link href={href({ status: undefined })} className={cn(CHIP, !status ? "border-brand bg-brand text-brand-fg" : "border-border text-muted hover:bg-surface-2")}>
          {t("All statuses")}
        </Link>
        {APPOINTMENT_STATUSES.map((k) => (
          <Link
            key={k}
            href={href({ status: k })}
            className={cn(CHIP, status === k ? "border-brand bg-brand text-brand-fg" : "border-border text-muted hover:bg-surface-2")}
          >
            {t(APPOINTMENT_STATUS_LABEL[k])}
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader title={t("Upcoming")} />
        <CardBody className="space-y-5">
          {days.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{t("Nothing scheduled.")}</p>
          ) : (
            days.map((d) => (
              <section key={d.date} data-day={d.date}>
                <h4 className="mb-1.5 font-mono text-xs font-semibold uppercase tracking-wide text-fg">
                  {militaryDate(d.date)}
                </h4>
                <AppointmentTable appointments={d.items} t={t} now={now} showDate={false} />
              </section>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("Past")} subtitle={t("Completed, cancelled, and visits whose time has gone by.")} />
        <CardBody>
          {past.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">{t("Nothing yet.")}</p>
          ) : (
            <AppointmentTable appointments={past} t={t} now={now} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
