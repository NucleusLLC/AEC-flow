"use client";

/**
 * Permit DEADLINES on the case file: the olive DEADLINE button, its dialog, and
 * the list of open deadlines with their colour (yellow / red / blinking red —
 * lib/building-permits/deadlines.ts).
 *
 * The list is rendered from the permit the case file owns; after a write this
 * calls `onChanged`, which re-reads the file through permitSnapshotAction, so a
 * saved deadline appears at once (router.refresh() does not reliably repaint
 * this page — see permit-case-file.tsx).
 *
 * Military: capital labels, olive drab, the same hexes as the Take-Off ADD NEW
 * dialog (components/estimates/add-norm-task-dialog.tsx).
 */

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, Siren, Trash2, X } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DeadlineChip } from "@/components/building-permits/deadline-chip";
import { militaryDate } from "@/lib/building-permits/register";
import {
  BLINK_DAYS,
  checkDeadlineInput,
  deadlineLabel,
  DEADLINE_LABEL_MAX,
  PERMIT_DEADLINE_KIND_LABEL,
  RED_DAYS,
  type DeadlineField,
  type PermitDeadlineDTO,
  type PermitDeadlineKind,
} from "@/lib/building-permits/deadlines";
import {
  addPermitDeadlineAction,
  deletePermitDeadlineAction,
  markPermitDeadlineMetAction,
} from "@/app/(app)/design/building-permits/actions";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";

const OLIVE_BUTTON =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#5c6633] bg-[#4b5320] px-3 text-sm font-semibold uppercase tracking-wide text-[#e4e8dc] shadow-sm hover:bg-[#3f4a1c] disabled:cursor-not-allowed disabled:opacity-50";

/** The kind's label in the reader's language; OTHER is what was typed. */
export function useDeadlineTitle() {
  const t = useT();
  return (d: { kind: PermitDeadlineKind; label: string | null }) =>
    d.kind === "OTHER" ? deadlineLabel(d) : t(PERMIT_DEADLINE_KIND_LABEL[d.kind]);
}

export function PermitDeadlines({
  permitId,
  deadlines,
  today,
  onChanged,
}: {
  permitId: string;
  deadlines: PermitDeadlineDTO[];
  today: string;
  onChanged: () => Promise<void>;
}) {
  const t = useT();
  const title = useDeadlineTitle();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function met(id: string) {
    setError(null);
    setBusyId(id);
    const res = await markPermitDeadlineMetAction(permitId, id).catch(() => ({ ok: false as const, error: "Failed to mark the deadline met." }));
    if (res.ok) await onChanged();
    else setError(res.error);
    setBusyId(null);
  }

  async function remove(id: string) {
    setError(null);
    setBusyId(id);
    const res = await deletePermitDeadlineAction(permitId, id).catch(() => ({ ok: false as const, error: "Failed to delete the deadline." }));
    if (res.ok) await onChanged();
    else setError(res.error);
    setConfirmId(null);
    setBusyId(null);
  }

  return (
    <div id="deadlines" className="scroll-mt-6">
      <Card>
        <CardHeader
          title={t("DEADLINES")}
          subtitle={fmt(t("Yellow more than {red} days out · red inside {red} days · blinking red inside {blink} days and when overdue."), {
            red: RED_DAYS,
            blink: BLINK_DAYS,
          })}
          action={
            <button type="button" onClick={() => setOpen(true)} className={OLIVE_BUTTON}>
              <Siren className="h-4 w-4" /> {t("DEADLINE")}
            </button>
          }
        />
        <CardBody>
          {error ? <p className="mb-2 text-sm text-red-600">{t(error)}</p> : null}
          {deadlines.length === 0 ? (
            <p className="text-sm text-muted">{t("No open deadlines. Press DEADLINE to set one.")}</p>
          ) : (
            <ul className="divide-y divide-border/60" aria-label={t("DEADLINES")}>
              {deadlines.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5" data-deadline-id={d.id}>
                  <DeadlineChip dueDate={d.dueDate} today={today} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold uppercase tracking-wide text-fg">{title(d)}</span>
                    <span className="block text-[11px] text-faint">
                      {d.createdByName ? fmt(t("Set by {name}"), { name: d.createdByName }) : null}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-fg">{militaryDate(d.dueDate)}</span>
                  {confirmId === d.id ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="text-xs text-muted">{t("Delete this deadline?")}</span>
                      <button
                        type="button"
                        onClick={() => void remove(d.id)}
                        disabled={busyId === d.id}
                        className="inline-flex h-8 items-center rounded-md bg-red-600 px-2.5 text-xs font-semibold uppercase text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {t("DELETE")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs text-muted hover:text-fg"
                      >
                        {t("Cancel")}
                      </button>
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void met(d.id)}
                        disabled={busyId === d.id}
                        title={t("Mark met — takes it off the dashboards")}
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-[#5c6633] bg-[#e4e8dc] px-2.5 text-xs font-bold uppercase tracking-wider text-[#4b5320] hover:bg-[#c5d18a] disabled:opacity-50"
                      >
                        {busyId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        {t("MET")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(d.id)}
                        disabled={busyId === d.id}
                        aria-label={t("DELETE")}
                        title={t("DELETE")}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {open ? (
        <DeadlineDialog
          permitId={permitId}
          today={today}
          onClose={() => setOpen(false)}
          onSaved={async () => {
            setOpen(false);
            await onChanged();
          }}
        />
      ) : null}
    </div>
  );
}

function DeadlineDialog({
  permitId,
  today,
  onClose,
  onSaved,
}: {
  permitId: string;
  today: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const t = useT();
  const [kind, setKind] = useState<PermitDeadlineKind>("SUBMIT_REVIEW");
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [errors, setErrors] = useState<Partial<Record<DeadlineField, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFailure(null);
    const draft = { kind, label: kind === "OTHER" ? label : null, dueDate };
    const check = checkDeadlineInput(draft);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setBusy(true);
    const res = await addPermitDeadlineAction(permitId, check.value).catch(() => ({
      ok: false as const,
      error: "Failed to save the deadline.",
      errors: undefined,
    }));
    if (res.ok) {
      await onSaved();
      return;
    }
    setBusy(false);
    if (res.errors) setErrors(res.errors);
    setFailure(res.error);
  };

  const field =
    "mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg outline-none focus:border-[#5c6633] focus:ring-2 focus:ring-[#8a9a5b]/30";
  const cap = "block text-[11px] font-semibold uppercase tracking-wider text-muted";

  const err = (k: DeadlineField) =>
    errors[k] ? (
      <span role="alert" className="mt-1 flex items-center gap-1 text-[11px] text-rose-600">
        <AlertTriangle className="h-3 w-3 shrink-0" /> {t(errors[k]!)}
      </span>
    ) : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={t("DEADLINE")}
        onSubmit={submit}
        noValidate
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[#5c6633] bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-[#4b5320] px-4 py-3 text-[#e4e8dc]">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
              <Siren className="h-4 w-4" /> {t("DEADLINE")}
            </div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-[#c5d18a]">
              {t("Shows on the Dashboard and the Office Dash until it is met")}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("Close")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#c5d18a] hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          {failure ? (
            <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">{t("Nothing was saved.")}</div>
                <div className="mt-0.5">{t(failure)}</div>
              </div>
            </div>
          ) : null}

          <label className="block">
            <span className={cap}>{t("TYPE")} *</span>
            <select
              name="kind"
              autoFocus
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as PermitDeadlineKind);
                setErrors((x) => ({ ...x, kind: undefined, label: undefined }));
              }}
              className={`${field} font-semibold uppercase`}
            >
              <option value="SUBMIT_REVIEW">{t("DEADLINE TO SUBMIT REVIEW")}</option>
              <option value="REPLY">{t("DEADLINE TO REPLY / RESPOND")}</option>
              <option value="OTHER">{t("OTHER")}</option>
            </select>
            {err("kind")}
          </label>

          {kind === "OTHER" ? (
            <label className="block">
              <span className={cap}>{t("DESCRIBE THE DEADLINE")} *</span>
              <input
                name="label"
                autoFocus
                value={label}
                maxLength={DEADLINE_LABEL_MAX}
                onChange={(e) => {
                  setLabel(e.target.value);
                  setErrors((x) => ({ ...x, label: undefined }));
                }}
                placeholder={t("e.g. Fire department sign-off")}
                aria-invalid={Boolean(errors.label)}
                className={`${field} uppercase ${errors.label ? "border-rose-400" : ""}`}
              />
              {err("label")}
            </label>
          ) : null}

          <label className="block">
            <span className={cap}>{t("DEADLINE DATE")} *</span>
            <input
              name="dueDate"
              type="date"
              value={dueDate}
              min={today}
              onChange={(e) => {
                setDueDate(e.target.value);
                setErrors((x) => ({ ...x, dueDate: undefined }));
              }}
              aria-invalid={Boolean(errors.dueDate)}
              className={`${field} font-mono ${errors.dueDate ? "border-rose-400" : ""}`}
            />
            {err("dueDate")}
            {dueDate ? <span className="mt-1 block font-mono text-[11px] text-faint">{militaryDate(dueDate)}</span> : null}
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted hover:text-fg disabled:opacity-40"
          >
            {t("Cancel")}
          </button>
          <button type="submit" disabled={busy} className={OLIVE_BUTTON}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {busy ? t("Saving…") : t("SAVE")}
          </button>
        </div>
      </form>
    </div>
  );
}
