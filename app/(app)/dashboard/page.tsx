import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowUpRight, ArrowDownRight, Minus, BarChart3, CalendarClock } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getBetaMembership } from "@/lib/data/account";
import { getServerT } from "@/lib/i18n/server";
import { Greeting } from "@/components/dashboard/greeting";
import { DashboardBackdrop } from "@/components/dashboard/dashboard-backdrop";
import { getUserPreferences } from "@/lib/data/preferences";
import { pickDashboardBackgroundIndex } from "@/lib/dashboard/backgrounds";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatusBadge, PriorityBadge, Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { getDashboardData, type Trend } from "@/lib/data/dashboard";
import { getRecentActivity } from "@/lib/data/activity";
import { formatCurrencyCompact, formatDate } from "@/lib/format";
import { initials } from "@/lib/utils";

export const metadata = { title: "Dashboard · AEC-flow" };

function TrendPill({ trend }: { trend?: Trend }) {
  if (!trend) return null;
  const Icon =
    trend.direction === "up" ? ArrowUpRight : trend.direction === "down" ? ArrowDownRight : Minus;
  const tone =
    trend.direction === "up"
      ? "text-emerald-600"
      : trend.direction === "down"
        ? "text-red-600"
        : "text-muted";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {trend.value}%
    </span>
  );
}

export default async function DashboardPage() {
  const { stats, pipeline, projects, onLeave } = await getDashboardData();
  const recentActivity = await getRecentActivity(8);
  const session = await getServerSession(authOptions);
  const firstName = session?.user?.name?.trim().split(/\s+/)[0] ?? "";
  const beta = session?.user?.id ? await getBetaMembership(session.user.id) : null;
  const betaUntil = beta?.betaAccessUntil ? new Date(beta.betaAccessUntil) : null;
  // eslint-disable-next-line react-hooks/purity -- async server component; per-request time is intended
  const nowMs = Date.now();
  const betaDaysLeft =
    betaUntil && !Number.isNaN(betaUntil.getTime())
      ? Math.max(0, Math.ceil((betaUntil.getTime() - nowMs) / 86_400_000))
      : null;
  const pipelineTotal = pipeline.reduce((sum, s) => sum + s.value, 0);
  const pipelineMax = Math.max(...pipeline.map((s) => s.value));
  const t = await getServerT();
  const { dashboardBackground, dashboardBackgroundIntervalSeconds } = await getUserPreferences(
    session?.user?.id,
  );

  const content = (
    <div className="w-full space-y-6">
      {/* Beta access countdown (beta testers only) */}
      {betaDaysLeft !== null && betaUntil ? (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border px-4 py-2.5 text-sm ${
            betaDaysLeft <= 14
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-brand/20 bg-brand/5 text-fg"
          }`}
        >
          <CalendarClock className={`h-4 w-4 shrink-0 ${betaDaysLeft <= 14 ? "text-amber-600" : "text-brand"}`} />
          <span>
            <strong className="font-semibold">{betaDaysLeft} {betaDaysLeft === 1 ? "day" : "days"}</strong> {t("left in your free beta access")}
          </span>
          <span className={betaDaysLeft <= 14 ? "text-amber-700" : "text-muted"}>
            · through {betaUntil.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
          </span>
          <span className="ml-auto text-xs text-muted">{t('Tap "New Bug/Wish" anytime to send feedback.')}</span>
        </div>
      ) : null}

      {/* Greeting */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Greeting name={firstName} />
          <p className="text-sm text-muted">
            {t("Here's what's happening across the practice today.")}
          </p>
        </div>
        <Link
          href="/reports"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <BarChart3 className="h-4 w-4 text-muted" />
          {t("View reports")}
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.key} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">{t(stat.label)}</span>
              <TrendPill trend={stat.trend} />
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-fg">{stat.value}</div>
            <div className="mt-1 text-xs text-faint">{stat.hint}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Active projects */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={t("Active Projects")}
            subtitle={t("Live delivery across the studio")}
            action={
              <Link href="/projects" className="text-xs font-medium text-brand hover:underline">
                {t("View all")}
              </Link>
            }
          />
          <div className="divide-y divide-border">
            {projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-faint">{p.number}</span>
                    <StatusBadge status={p.status} />
                    <PriorityBadge priority={p.priority} />
                  </div>
                  <div className="mt-0.5 truncate text-sm font-medium text-fg group-hover:text-brand">
                    {p.name}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {p.client} · {p.manager}
                  </div>
                </div>
                <div className="hidden w-40 shrink-0 sm:block">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
                    <span>{p.progressPct}%</span>
                    <span>{formatDate(p.targetEndDate)}</span>
                  </div>
                  <ProgressBar value={p.progressPct} />
                </div>
              </Link>
            ))}
          </div>
        </Card>

        {/* On leave today */}
        <Card>
          <CardHeader
            title={t("Out of Office")}
            subtitle={t("On leave this week")}
            action={
              <Link href="/leave" className="text-xs font-medium text-brand hover:underline">
                {t("View all")}
              </Link>
            }
          />
          <div className="divide-y divide-border">
            {onLeave.map((person) => (
              <div key={person.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {initials(person.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-fg">{person.name}</div>
                  <div className="text-xs text-muted">Back {formatDate(person.until)}</div>
                </div>
                <Badge tone="slate">{person.type}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Proposals pipeline */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={t("Proposals Pipeline")}
            subtitle={`${formatCurrencyCompact(pipelineTotal)} across ${pipeline.reduce(
              (n, s) => n + s.count,
              0,
            )} proposals`}
            action={
              <Link href="/proposals" className="text-xs font-medium text-brand hover:underline">
                {t("View all")}
              </Link>
            }
          />
          <CardBody className="space-y-4">
            {pipeline.map((stage) => (
              <div key={stage.stage}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-fg">
                    {stage.stage} <span className="text-faint">· {stage.count}</span>
                  </span>
                  <span className="text-muted">{formatCurrencyCompact(stage.value)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${(stage.value / pipelineMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Recent activity — real ActivityLog feed */}
        <Card>
          <CardHeader
            title={t("Recent Activity")}
            action={
              <Link href="/activity" className="text-xs font-medium text-brand hover:underline">
                {t("View all")}
              </Link>
            }
          />
          <CardBody>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted">{t("No recent activity.")}</p>
            ) : (
              <ol className="space-y-4">
                {recentActivity.map((entry) => (
                  <li key={entry.id} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand/70" />
                    <div className="min-w-0">
                      <p className="text-sm text-fg">
                        <span className="font-medium">{entry.actor}</span>{" "}
                        <span className="text-muted">
                          {entry.action} {entry.entityType}
                        </span>{" "}
                        {entry.href ? (
                          <Link href={entry.href} className="font-medium hover:text-brand hover:underline">
                            {entry.entityLabel}
                          </Link>
                        ) : (
                          <span className="font-medium">{entry.entityLabel}</span>
                        )}
                      </p>
                      <p className="text-xs text-faint">{entry.at}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );

  // Opt-in per user. Off (the default) returns the markup above untouched — the
  // backdrop wrapper, the glass hook and the rotation only exist when it is on.
  if (!dashboardBackground) return content;

  return (
    <DashboardBackdrop
      initialIndex={pickDashboardBackgroundIndex(session?.user?.id)}
      intervalSeconds={dashboardBackgroundIntervalSeconds}
    >
      {content}
    </DashboardBackdrop>
  );
}
