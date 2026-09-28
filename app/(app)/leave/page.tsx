import Link from "next/link";
import { Plus, Plane, CalendarHeart } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { LeaveView } from "@/components/leave/leave-view";
import { LeaveTypeBadge } from "@/components/leave/badges";
import { Badge } from "@/components/ui/badge";
import {
  getLeaveRequests,
  getWhoIsOut,
  getUpcomingHolidays,
  summarizeLeave,
} from "@/lib/data/leave";
import { formatDate } from "@/lib/format";
import { initials } from "@/lib/utils";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export const metadata = { title: "Leave · AEC-flow" };

export default async function LeavePage() {
  const [requests, whoIsOut, holidays] = await Promise.all([
    getLeaveRequests(),
    getWhoIsOut(),
    getUpcomingHolidays(),
  ]);
  const summary = summarizeLeave(requests, holidays);
  const t = await getServerT();

  const tiles = [
    { label: t("Pending Requests"), value: String(summary.pendingCount), hint: t("awaiting approval") },
    { label: t("Out Today"), value: String(summary.outTodayCount), hint: t("team members away") },
    {
      label: t("Upcoming Leave"),
      value: String(summary.upcomingApprovedCount),
      hint: t("approved, not started"),
    },
    {
      label: t("Next Holiday"),
      value: summary.nextHoliday ? formatDate(summary.nextHoliday.date) : "—",
      hint: summary.nextHoliday?.name ?? t("none scheduled"),
    },
  ];

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("Leave")}</h2>
          <p className="text-sm text-muted">
            {t("Requests and approvals, who’s out, and upcoming public holidays.")}
          </p>
        </div>
        <Link
          href="/leave/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          {t("Request Leave")}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-5">
            <div className="text-sm text-muted">{tile.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-fg">{tile.value}</div>
            <div className="mt-1 truncate text-xs text-faint">{tile.hint}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LeaveView requests={requests} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("Out This Week")} subtitle={fmt(t("{count} away"), { count: whoIsOut.length })} />
            <div className="divide-y divide-border">
              {whoIsOut.length > 0 ? (
                whoIsOut.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {initials(p.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-fg">{p.name}</div>
                      <div className="text-xs text-muted">{fmt(t("Back {date}"), { date: formatDate(p.until) })}</div>
                    </div>
                    <LeaveTypeBadge type={p.type} />
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted">
                  <Plane className="h-4 w-4 text-faint" />
                  {t("Everyone’s in this week.")}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title={t("Upcoming Holidays")} />
            <div className="divide-y divide-border">
              {holidays.map((h) => (
                <div key={h.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <CalendarHeart className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-fg">{h.name}</div>
                    <div className="text-xs text-muted">{formatDate(h.date)}</div>
                  </div>
                  {h.isCompany ? <Badge tone="violet">{t("Company")}</Badge> : <Badge tone="slate">{t("Public")}</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
