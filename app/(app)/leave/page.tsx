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

export const metadata = { title: "Leave · ZenArch" };

export default async function LeavePage() {
  const [requests, whoIsOut, holidays] = await Promise.all([
    getLeaveRequests(),
    getWhoIsOut(),
    getUpcomingHolidays(),
  ]);
  const summary = summarizeLeave(requests, holidays);

  const tiles = [
    { label: "Pending Requests", value: String(summary.pendingCount), hint: "awaiting approval" },
    { label: "Out Today", value: String(summary.outTodayCount), hint: "team members away" },
    {
      label: "Upcoming Leave",
      value: String(summary.upcomingApprovedCount),
      hint: "approved, not started",
    },
    {
      label: "Next Holiday",
      value: summary.nextHoliday ? formatDate(summary.nextHoliday.date) : "—",
      hint: summary.nextHoliday?.name ?? "none scheduled",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Leave</h2>
          <p className="text-sm text-muted">
            Requests and approvals, who&apos;s out, and upcoming public holidays.
          </p>
        </div>
        <Link
          href="/leave/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" />
          Request Leave
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-5">
            <div className="text-sm text-muted">{t.label}</div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-fg">{t.value}</div>
            <div className="mt-1 truncate text-xs text-faint">{t.hint}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LeaveView requests={requests} />
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Out This Week" subtitle={`${whoIsOut.length} away`} />
            <div className="divide-y divide-border">
              {whoIsOut.length > 0 ? (
                whoIsOut.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                      {initials(p.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-fg">{p.name}</div>
                      <div className="text-xs text-muted">Back {formatDate(p.until)}</div>
                    </div>
                    <LeaveTypeBadge type={p.type} />
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted">
                  <Plane className="h-4 w-4 text-faint" />
                  Everyone&apos;s in this week.
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Upcoming Holidays" />
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
                  {h.isCompany ? <Badge tone="violet">Company</Badge> : <Badge tone="slate">Public</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
