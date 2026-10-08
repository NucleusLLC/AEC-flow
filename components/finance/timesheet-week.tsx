"use client";

/**
 * A week of somebody's hours: the grid, the totals, and the one form that adds
 * to it.
 *
 * EVERY FIGURE ON THIS SCREEN COMES FROM lib/finance/timesheet.ts — the same
 * module the server stores through. The week total the person sees while typing
 * is the week total a director approves and the figure that reaches an invoice.
 *
 * BILLABLE AND NON-BILLABLE HOURS ARE SEPARATE ROWS, even on the same project.
 * They are different things: one is stock, the other is overhead. A grid that
 * adds them into one cell hides the number the practice is managing.
 *
 * THE WEEK IS NAVIGATED BY URL (`?week=YYYY-MM-DD`), not by client state, so a
 * saved entry comes back from the server on the week it was saved on. Router
 * state plus `router.refresh()` is exactly the pattern that left the permit
 * case file stale — see components/building-permits/permit-case-file.tsx.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Send, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { ApprovalBadge, BilledBadge } from "@/components/finance/badges";
import { formatCurrency } from "@/lib/format";
import {
  shiftWeek,
  timesheetGrid,
  timesheetTotals,
  toQuarterHour,
  utilisationPct,
} from "@/lib/finance/timesheet";
import type { TimeEntryDTO } from "@/lib/finance/types";
import {
  deleteTimeEntryAction,
  logTimeAction,
  submitTimeAction,
} from "@/app/(app)/finance/time/actions";

export type PickerOption = { id: string; name: string };
/** A project's phase, for the PHASE dropdown beside the project. */
export type PhaseOption = { id: string; name: string; projectId: string };

const CONTROL =
  "h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

const DAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayHeading(date: string): { day: string; date: string } {
  const d = new Date(`${date}T00:00:00Z`);
  return { day: DAY_LABEL[d.getUTCDay()], date: String(d.getUTCDate()).padStart(2, "0") };
}

export function TimesheetWeek({
  start,
  days,
  entries,
  projects,
  phases = [],
  people,
  personName,
  userId,
  canLogForOthers,
  currency,
  today,
}: {
  start: string;
  days: string[];
  entries: TimeEntryDTO[];
  projects: PickerOption[];
  phases?: PhaseOption[];
  people: PickerOption[];
  personName: string;
  userId: string;
  canLogForOthers: boolean;
  currency: string;
  today: string;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const grid = useMemo(() => timesheetGrid(entries, days), [entries, days]);
  const totals = useMemo(() => timesheetTotals(entries, currency), [entries, currency]);

  const submittable = entries.filter((e) => e.status === "DRAFT" || e.status === "REJECTED");

  const money = (n: number) =>
    formatCurrency(n, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function go(weeks: number) {
    router.push(`/finance/time?week=${shiftWeek(start, weeks)}${userIdParam()}`);
  }

  function userIdParam(): string {
    return canLogForOthers ? `&user=${encodeURIComponent(userId)}` : "";
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? t("That did not save."));
      else router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={t("The week before")}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted hover:bg-surface-2"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="px-2 text-sm font-medium text-fg">
            {fmt(t("Week of {from} – {to}"), { from: days[0], to: days[6] })}
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={t("The week after")}
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted hover:bg-surface-2"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => router.push(`/finance/time${canLogForOthers ? `?user=${userId}` : ""}`)}
            className="ml-2 h-9 rounded-lg border border-border px-3 text-sm text-muted hover:bg-surface-2"
          >
            {t("This week")}
          </button>
        </div>

        {canLogForOthers && people.length > 1 ? (
          <select
            value={userId}
            onChange={(e) => router.push(`/finance/time?week=${start}&user=${e.target.value}`)}
            aria-label={t("Whose timesheet")}
            className={CONTROL}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-muted">{personName}</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label={t("Hours")} value={totals.hours.toFixed(2)} />
        <Tile
          label={t("Billable")}
          value={totals.billableHours.toFixed(2)}
          note={fmt(t("{percent}% of the week"), {
            percent: utilisationPct(totals.billableHours, totals.hours),
          })}
        />
        <Tile label={t("Worth")} value={money(totals.value)} />
        <Tile
          label={t("Waiting to send")}
          value={String(submittable.length)}
          note={submittable.length > 0 ? t("Not yet with an approver") : undefined}
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-sm text-red-600">
          {t(error)}
        </p>
      ) : null}

      <Card>
        <CardHeader
          title={t("The week")}
          subtitle={t("Billable and non-billable hours are separate rows — they are different things.")}
          action={
            submittable.length > 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => submitTimeAction(submittable.map((e) => e.id)))}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" />{" "}
                {fmt(t("Send {count} for approval"), { count: submittable.length })}
              </button>
            ) : null
          }
        />
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 pb-1.5 font-medium">{t("Project")}</th>
                {days.map((d) => {
                  const h = dayHeading(d);
                  return (
                    <th
                      key={d}
                      className={`px-2 pb-1.5 text-right font-medium ${d === today ? "text-brand" : ""}`}
                    >
                      {t(h.day)} {h.date}
                    </th>
                  );
                })}
                <th className="px-3 pb-1.5 text-right font-medium">{t("Total")}</th>
              </tr>
            </thead>
            <tbody>
              {grid.rows.length === 0 ? (
                <tr>
                  <td colSpan={days.length + 2} className="px-3 py-8 text-center text-sm text-muted">
                    {t("Nothing logged this week.")}
                  </td>
                </tr>
              ) : (
                grid.rows.map((row) => (
                  <tr key={row.key} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 align-top">
                      <div className="font-medium text-fg">
                        {row.projectName === "No project" ? t("No project") : row.projectName}
                      </div>
                      {!row.billable ? (
                        <div className="text-[11px] text-faint">{t("Non-billable")}</div>
                      ) : null}
                    </td>
                    {row.cells.map((c) => (
                      <td
                        key={c.date}
                        className="px-2 py-2 text-right align-top font-mono tabular-nums text-muted"
                      >
                        {c.hours > 0 ? c.hours.toFixed(2) : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right align-top font-mono font-semibold tabular-nums text-fg">
                      {row.total.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {grid.rows.length > 0 ? (
              <tfoot>
                <tr className="border-t border-border">
                  <td className="px-3 py-2 text-[11px] uppercase tracking-wide text-faint">{t("Total")}</td>
                  {grid.dayTotals.map((n, i) => (
                    <td
                      key={days[i]}
                      className="px-2 py-2 text-right font-mono tabular-nums text-fg"
                    >
                      {n > 0 ? n.toFixed(2) : "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums text-fg">
                    {grid.total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </CardBody>
      </Card>

      <LogRow
        days={days}
        projects={projects}
        phases={phases}
        today={today}
        pending={pending}
        userId={canLogForOthers ? userId : undefined}
        onSave={(input) => run(() => logTimeAction(input))}
      />

      {entries.length > 0 ? (
        <Card>
          <CardHeader title={t("Entries")} />
          <CardBody className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-3 pb-1.5 font-medium">{t("Date")}</th>
                  <th className="px-3 pb-1.5 font-medium">{t("Project")}</th>
                  <th className="px-3 pb-1.5 font-medium">{t("What")}</th>
                  <th className="px-3 pb-1.5 text-right font-medium">{t("Hours")}</th>
                  <th className="px-3 pb-1.5 text-right font-medium">{t("Worth")}</th>
                  <th className="px-3 pb-1.5 font-medium">{t("Status")}</th>
                  <th className="px-3 pb-1.5" />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-xs tabular-nums text-muted">
                      {e.date}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="text-fg">{e.projectName ?? t("No project")}</div>
                      {e.phaseName ? (
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5c6633]">{e.phaseName}</div>
                      ) : null}
                      {!e.billable ? (
                        <div className="text-[11px] text-faint">{t("Non-billable")}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top text-muted">{e.description ?? "—"}</td>
                    <td className="px-3 py-2 text-right align-top font-mono tabular-nums text-fg">
                      {e.hours.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right align-top font-mono tabular-nums text-muted">
                      {e.billable ? money(e.value) : "—"}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col items-start gap-1">
                        <ApprovalBadge status={e.status} />
                        <BilledBadge invoiceNumber={e.invoiceNumber} />
                        {e.rejectedReason ? (
                          <span className="text-[11px] text-red-600">{e.rejectedReason}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right align-top">
                      {e.invoicedAt ? null : (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => run(() => deleteTimeEntryAction(e.id))}
                          aria-label={fmt(t("Delete the {hours} hours on {date}"), { hours: e.hours, date: e.date })}
                          className="text-faint transition-colors hover:text-red-600 disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}

/** The add form. One row, because logging an hour should cost less than an hour. */
function LogRow({
  days,
  projects,
  phases,
  today,
  pending,
  userId,
  onSave,
}: {
  days: string[];
  projects: PickerOption[];
  phases: PhaseOption[];
  today: string;
  pending: boolean;
  userId?: string;
  onSave: (input: {
    userId?: string | null;
    projectId: string | null;
    phaseId: string | null;
    date: string;
    hours: number;
    billable: boolean;
    description: string | null;
  }) => void;
}) {
  const t = useT();
  const [date, setDate] = useState(days.includes(today) ? today : days[0]);
  const [projectId, setProjectId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const projectPhases = projectId ? phases.filter((p) => p.projectId === projectId) : [];
  const [hours, setHours] = useState("");
  const [billable, setBillable] = useState(true);
  const [description, setDescription] = useState("");

  const parsed = toQuarterHour(Number(hours.replace(",", ".")));

  return (
    <Card>
      <CardHeader
        title={t("Log hours")}
        subtitle={t("Quarter hours. The rate on your record is copied onto the entry as it is saved.")}
      />
      <CardBody className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-faint">{t("Day")}</span>
          <select value={date} onChange={(e) => setDate(e.target.value)} className={CONTROL}>
            {days.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-faint">{t("Project")}</span>
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              // A phase belongs to one project: changing the project clears it.
              setPhaseId("");
            }}
            className={`${CONTROL} w-full`}
          >
            <option value="">{t("No project")}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {projectId ? (
          <label className="flex min-w-[180px] flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-faint">{t("PHASE")}</span>
            <select
              value={phaseId}
              onChange={(e) => setPhaseId(e.target.value)}
              aria-label={t("Phase")}
              className={`${CONTROL} w-full`}
            >
              <option value="">{t("— No phase —")}</option>
              {projectPhases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-faint">{t("Hours")}</span>
          <input
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            inputMode="decimal"
            placeholder="0.25"
            aria-label={t("Hours worked")}
            className={`${CONTROL} w-24 text-right font-mono tabular-nums`}
          />
        </label>

        <label className="flex min-w-[220px] flex-[2] flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-faint">{t("What was done")}</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("Coordination meeting, permit drawings…")}
            className={`${CONTROL} w-full placeholder:text-faint`}
          />
        </label>

        <label className="flex h-9 items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={billable}
            onChange={(e) => setBillable(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          {t("Billable")}
        </label>

        <button
          type="button"
          disabled={pending || parsed <= 0}
          onClick={() => {
            onSave({
              userId: userId ?? null,
              projectId: projectId || null,
              phaseId: (projectId && phaseId) || null,
              date,
              hours: parsed,
              billable,
              description: description.trim() || null,
            });
            setHours("");
            setDescription("");
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> {t("Log")}
        </button>
      </CardBody>
    </Card>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <CardBody className="py-3">
        <div className="text-[11px] uppercase tracking-wide text-faint">{label}</div>
        <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-fg">{value}</div>
        {note ? <div className="text-[11px] text-faint">{note}</div> : null}
      </CardBody>
    </Card>
  );
}
