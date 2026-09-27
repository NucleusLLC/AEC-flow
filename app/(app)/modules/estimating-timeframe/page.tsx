import Link from "next/link";
import { Calculator, CalendarClock, FileOutput, FolderArchive, ArrowUpRight } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/format";
import { MODULE_MAP } from "@/lib/modules";
import {
  getEstimateSummaries,
  getEstimateSummaryById,
  getEstimateRecordUrl,
  getEstimatePrintUrl,
} from "@/lib/integrations/estimates/adapter";
import {
  getProjectScheduleSummary,
  getScheduleUrl,
  getSchedulePrintUrl,
} from "@/lib/integrations/schedule/adapter";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export const metadata = { title: "Module 3 Dashboard · AEC-flow" };

const M3 = MODULE_MAP.estimating_timeframe;

const EST_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-slate-500/10 text-slate-500" },
  in_review: { label: "In review", cls: "bg-amber-500/10 text-amber-600" },
  approved: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-600" },
};
const SCH_STATUS: Record<string, { label: string; cls: string }> = {
  "on-track": { label: "On track", cls: "bg-emerald-500/10 text-emerald-600" },
  watch: { label: "Watch", cls: "bg-amber-500/10 text-amber-600" },
  "at-risk": { label: "At risk", cls: "bg-red-500/10 text-red-600" },
  empty: { label: "No activities", cls: "bg-slate-500/10 text-slate-500" },
};

function Badge({ label, cls, t }: { label: string; cls: string; t: (text: string) => string }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{t(label)}</span>;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-right text-sm font-medium text-fg">{value}</span>
    </div>
  );
}

function OpenButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-brand-fg transition-opacity hover:opacity-90"
    >
      {children}
      <ArrowUpRight className="h-4 w-4" />
    </Link>
  );
}

export default async function Module3Dashboard() {
  // "Current" = newest estimate (getEstimateProjects orders by date desc).
  const estimates = await getEstimateSummaries();
  const newest = estimates[0];
  const est = newest ? await getEstimateSummaryById(newest.estimateId) : null;
  // "Active" schedule = the one for the current estimate's project.
  const sched = est?.found ? await getProjectScheduleSummary(est.projectNumber) : null;
  const t = await getServerT();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Module identity header */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-brand">
          {fmt(t("Module {number}"), { number: M3.number })} · {M3.version}
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-fg">
          {t("Construction Estimates & Construction Timeframe")}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {t("Read-only overview. Estimates and Schedule open in their own systems — the numbers here come straight from those systems, unchanged.")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Estimates summary (spec §9) */}
        <Card>
          <CardHeader
            title={t("Estimates")}
            subtitle={t("Current estimate")}
            action={<Calculator className="h-5 w-5 text-brand" />}
          />
          <CardBody>
            {est?.found ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-fg">{est.projectName}</div>
                    <div className="truncate text-xs text-muted">
                      {est.projectNumber || "—"} · {est.version}
                    </div>
                  </div>
                  <Badge {...(EST_STATUS[est.status] ?? EST_STATUS.draft)} t={t} />
                </div>
                <div className="divide-y divide-border/60">
                  <Field label={t("Current total")} value={formatCurrency(est.grandTotal, est.currency)} />
                  <Field label={t("Direct cost")} value={formatCurrency(est.direct, est.currency)} />
                  <Field
                    label={t("Cost per m²")}
                    value={est.costPerM2 != null ? formatCurrency(est.costPerM2, est.currency) : "—"}
                  />
                  <Field label={t("Last modified")} value={formatDate(est.date)} />
                  <Field label={t("Version lock")} value={est.locked ? t("Locked") : t("Unlocked")} />
                </div>
                <div className="mt-4">
                  <OpenButton href={getEstimateRecordUrl(est.projectNumber)}>{t("Open Estimates")}</OpenButton>
                </div>
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">{t("No estimates yet.")}</p>
                <div className="mt-3">
                  <OpenButton href="/estimates">{t("Open Estimates")}</OpenButton>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Schedule summary (spec §9) */}
        <Card>
          <CardHeader
            title={t("Schedule")}
            subtitle={t("Active programme")}
            action={<CalendarClock className="h-5 w-5 text-brand" />}
          />
          <CardBody>
            {sched?.found ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-fg">{sched.projectName}</div>
                    <div className="truncate text-xs text-muted">
                      {sched.projectId} · {fmt(t("{count} activities"), { count: sched.taskCount })}
                    </div>
                  </div>
                  <Badge {...(SCH_STATUS[sched.overall] ?? SCH_STATUS.empty)} t={t} />
                </div>
                <div className="divide-y divide-border/60">
                  <Field label={t("Overall progress")} value={`${sched.pctActual}%`} />
                  <Field label={t("Planned start")} value={formatDate(sched.plannedStart)} />
                  <Field label={t("Planned finish")} value={formatDate(sched.plannedFinish)} />
                  <Field
                    label={t("Forecast finish")}
                    value={sched.forecastFinish ? formatDate(sched.forecastFinish) : "—"}
                  />
                  <Field
                    label={t("Schedule variance")}
                    value={`${sched.varianceDays >= 0 ? "+" : ""}${sched.varianceDays} d`}
                  />
                  <Field label={t("Critical activities")} value={sched.criticalCount} />
                </div>
                <div className="mt-4">
                  <OpenButton href={getScheduleUrl()}>{t("Open Schedule")}</OpenButton>
                </div>
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-muted">
                  {est?.found ? t("No schedule for this project yet.") : t("No schedule yet.")}
                </p>
                <div className="mt-3">
                  <OpenButton href="/schedule">{t("Open Schedule")}</OpenButton>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Documents (spec §9) */}
      <Card>
        <CardHeader title={t("Documents")} subtitle={t("Generate from Estimates or Schedule (source data unchanged)")} />
        <CardBody className="flex flex-wrap gap-3">
          <Link
            href={
              est?.found
                ? `/documents/generate?source=estimates&recordId=${encodeURIComponent(est.estimateId)}`
                : "/documents/generate?source=estimates"
            }
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <FileOutput className="h-4 w-4 text-brand" /> {t("Generate Estimate document")}
          </Link>
          <Link
            href={
              sched?.found
                ? `/documents/generate?source=schedule&recordId=${encodeURIComponent(sched.projectId)}`
                : "/documents/generate?source=schedule"
            }
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <FileOutput className="h-4 w-4 text-brand" /> {t("Generate Schedule document")}
          </Link>
          <Link
            href="/documents/register"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <FolderArchive className="h-4 w-4 text-brand" /> {t("View generated documents")}
          </Link>
          {est?.found ? (
            <Link
              href={getEstimatePrintUrl(est.estimateId)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {t("Existing estimate PDF")} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
          {sched?.found ? (
            <Link
              href={getSchedulePrintUrl(sched.projectId)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              {t("Existing programme PDF")} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
