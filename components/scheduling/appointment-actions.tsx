"use client";

/**
 * What can still be done to an appointment, given where it stands.
 *
 * The rules come from lib/scheduling/calc.ts and are used here only to decide
 * which buttons to show; the data layer enforces them. Open (scheduled or
 * postponed): edit, complete, postpone, cancel — and delete while still
 * SCHEDULED with nothing logged. Completed: put the hours on the timesheets,
 * once, when that has not happened yet.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, CalendarClock, CheckCircle2, Clock3, Pencil, Trash2 } from "lucide-react";
import {
  cancelAppointmentAction,
  completeAppointmentAction,
  deleteAppointmentAction,
  logAppointmentTimeAction,
  postponeAppointmentAction,
} from "@/app/(app)/scheduling/actions";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import {
  canCancel,
  canComplete,
  canDelete,
  canEdit,
  canPostpone,
  timesheetBlocker,
} from "@/lib/scheduling/calc";
import type { AppointmentDTO, TimesheetOutcome } from "@/lib/scheduling/types";

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-60";
const PRIMARY =
  "inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60";
const DANGER =
  "inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-600/90 disabled:opacity-60";
const INPUT = "h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg";
const LABEL = "mb-1 block text-xs font-medium text-muted";
const PANEL = "space-y-3 rounded-lg border border-border bg-surface-2/40 p-3";

type Result =
  | { ok: true; id: string; timesheet?: TimesheetOutcome | null; note?: string | null }
  | { ok: false; error: string };

export function AppointmentActions({ appointment: a }: { appointment: AppointmentDTO }) {
  const t = useT();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [asking, setAsking] = useState<null | "complete" | "postpone" | "cancel" | "delete">(null);

  const [hours, setHours] = useState(String(a.actualHours ?? a.plannedHours));
  const [outcome, setOutcome] = useState(a.outcome ?? "");
  const blocker = timesheetBlocker(a);
  const [logIt, setLogIt] = useState(blocker === null);
  const [newDate, setNewDate] = useState(a.date);
  const [newStart, setNewStart] = useState(a.startTime);
  const [newEnd, setNewEnd] = useState(a.endTime);
  const [reason, setReason] = useState("");

  function said(r: { timesheet?: TimesheetOutcome | null; note?: string | null }): string | null {
    const parts: string[] = [];
    if (r.timesheet && r.timesheet.logged > 0) {
      const names = r.timesheet.loggedFor.join(", ");
      parts.push(
        r.timesheet.logged === 1
          ? fmt(t("1 draft timesheet entry created ({names})."), { names })
          : fmt(t("{count} draft timesheet entries created ({names})."), { count: r.timesheet.logged, names }),
      );
    }
    if (r.note) parts.push(t(r.note));
    return parts.length ? parts.join(" ") : null;
  }

  function run(fn: () => Promise<Result>, then?: (r: Result & { ok: true }) => void) {
    setError(null);
    setMessage(null);
    setPending(true);
    void (async () => {
      const res = await fn();
      setPending(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAsking(null);
      setMessage(said(res));
      if (then) then(res);
      else router.refresh();
    })();
  }

  const open = canEdit(a.status);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {open ? (
          <>
            <Link href={`/scheduling/${a.id}/edit`} className={BTN}>
              <Pencil className="h-4 w-4" /> {t("Edit")}
            </Link>
            {canComplete(a.status) ? (
              <button type="button" disabled={pending} onClick={() => setAsking("complete")} className={PRIMARY}>
                <CheckCircle2 className="h-4 w-4" /> {t("Complete visit")}
              </button>
            ) : null}
            {canPostpone(a.status) ? (
              <button type="button" disabled={pending} onClick={() => setAsking("postpone")} className={BTN}>
                <CalendarClock className="h-4 w-4" /> {t("Postpone")}
              </button>
            ) : null}
            {canCancel(a.status) ? (
              <button type="button" disabled={pending} onClick={() => setAsking("cancel")} className={`${BTN} text-red-600`}>
                <Ban className="h-4 w-4" /> {t("Cancel appointment")}
              </button>
            ) : null}
            {canDelete(a) ? (
              <button type="button" disabled={pending} onClick={() => setAsking("delete")} className={`${BTN} text-red-600`}>
                <Trash2 className="h-4 w-4" /> {t("Delete")}
              </button>
            ) : null}
          </>
        ) : null}

        {a.status === "COMPLETED" && !a.timeLoggedAt ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => logAppointmentTimeAction(a.id))}
            className={BTN}
            title={blocker ? t(blocker) : undefined}
          >
            <Clock3 className="h-4 w-4" /> {t("Add to timesheets")}
          </button>
        ) : null}
      </div>

      {asking === "complete" ? (
        <div className={PANEL} data-testid="complete-panel">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={LABEL} htmlFor="sch-actual">
                {t("Actual hours")}
              </label>
              <input
                id="sch-actual"
                type="number"
                min={0.25}
                max={24}
                step={0.25}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className={`${INPUT} w-28`}
              />
            </div>
            <p className="pb-2 text-[11px] text-faint">
              {fmt(t("Planned: {hours}"), { hours: `${a.plannedHours} h` })}
            </p>
          </div>
          <div>
            <label className={LABEL} htmlFor="sch-outcome">
              {t("Outcome")}
            </label>
            <textarea
              id="sch-outcome"
              rows={3}
              maxLength={4000}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder={t("What was found, measured or agreed")}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg"
            />
          </div>
          <label className={`flex items-start gap-2 text-sm ${blocker ? "text-faint" : "text-fg"}`}>
            <input
              id="sch-log"
              type="checkbox"
              checked={logIt && !blocker}
              disabled={Boolean(blocker)}
              onChange={(e) => setLogIt(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              {t("Add to timesheets")}
              <span className="block text-[11px] text-faint">
                {blocker
                  ? t(blocker)
                  : t("One draft entry per team member who attended, on the project, for the hours above.")}
              </span>
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  completeAppointmentAction(a.id, {
                    actualHours: hours,
                    outcome,
                    logToTimesheet: logIt && !blocker,
                  }),
                )
              }
              className={PRIMARY}
            >
              {t("Mark completed")}
            </button>
            <button type="button" onClick={() => setAsking(null)} className={BTN}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      ) : null}

      {asking === "postpone" ? (
        <div className={PANEL}>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={LABEL} htmlFor="sch-pp-date">
                {t("New date")}
              </label>
              <input id="sch-pp-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL} htmlFor="sch-pp-start">
                {t("Start")}
              </label>
              <input id="sch-pp-start" type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className={LABEL} htmlFor="sch-pp-end">
                {t("End")}
              </label>
              <input id="sch-pp-end" type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className={INPUT} />
            </div>
            <div className="min-w-[220px] flex-1">
              <label className={LABEL} htmlFor="sch-pp-reason">
                {t("Reason (optional)")}
              </label>
              <input id="sch-pp-reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className={`${INPUT} w-full`} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  postponeAppointmentAction(a.id, { date: newDate, startTime: newStart, endTime: newEnd, reason }),
                )
              }
              className={PRIMARY}
            >
              {t("Move it")}
            </button>
            <button type="button" onClick={() => setAsking(null)} className={BTN}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      ) : null}

      {asking === "cancel" ? (
        <div className={PANEL}>
          <div>
            <label className={LABEL} htmlFor="sch-cancel-reason">
              {t("Why is it cancelled?")}
            </label>
            <input
              id="sch-cancel-reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              className={`${INPUT} w-full`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={() => run(() => cancelAppointmentAction(a.id, { reason }))} className={DANGER}>
              {t("Cancel appointment")}
            </button>
            <button type="button" onClick={() => setAsking(null)} className={BTN}>
              {t("Keep it")}
            </button>
          </div>
        </div>
      ) : null}

      {asking === "delete" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2/40 p-3">
          <span className="text-sm text-fg">{t("Delete this appointment?")}</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => deleteAppointmentAction(a.id), () => router.push("/scheduling"))}
            className={DANGER}
          >
            {t("Delete")}
          </button>
          <button type="button" onClick={() => setAsking(null)} className={BTN}>
            {t("Keep it")}
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-fg" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}
