"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Plus, X } from "lucide-react";
import { addNormSetTaskAction } from "@/app/(app)/estimates/norm-set-actions";
import {
  checkNormTaskDraft,
  EMPTY_NORM_TASK_DRAFT,
  type NormTaskDraft,
  type NormTaskField,
} from "@/lib/estimates/norm-task-draft";
import { ESTIMATE_UNITS } from "@/lib/data/estimates.types";
import type { NormSetTask } from "@/lib/data/estimate-presets";
import { useT } from "@/components/i18n/language-provider";

/**
 * Take-Off "ADD NEW" — type in an item the Norm Set dropdown does not have. It
 * joins the firm's Norm Set (so it is offered everywhere from now on) and is
 * linked to the take-off row that asked for it. See lib/estimates/norm-task-draft.ts.
 *
 * Military: capital labels, olive drab, the same hexes as the Take-Off Save button.
 */
export function AddNormTaskDialog({
  trades,
  initialTask,
  onClose,
  onAdded,
}: {
  /** Existing trades, offered as suggestions; a new one may be typed. */
  trades: string[];
  /** What the row's description already says, to save retyping it. */
  initialTask: string;
  onClose: () => void;
  onAdded: (task: NormSetTask) => void;
}) {
  const t = useT();
  const [d, setD] = useState<NormTaskDraft>({ ...EMPTY_NORM_TASK_DRAFT, task: initialTask, trade: trades[0] ?? "" });
  const [errors, setErrors] = useState<Partial<Record<NormTaskField, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const set = (k: NormTaskField, v: string) => {
    setD((s) => ({ ...s, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFailure(null);
    const check = checkNormTaskDraft(d);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setBusy(true);
    const res = await addNormSetTaskAction(d).catch(() => ({ ok: false as const, error: "The item could not be added." }));
    setBusy(false);
    if (res.ok) {
      onAdded(res.task);
      return;
    }
    if ("errors" in res && res.errors) setErrors(res.errors);
    if (res.error) setFailure(res.error);
  };

  const field =
    "mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg outline-none focus:border-[#5c6633] focus:ring-2 focus:ring-[#8a9a5b]/30";
  const label = "block text-[11px] font-semibold uppercase tracking-wider text-muted";

  const Err = ({ k }: { k: NormTaskField }) =>
    errors[k] ? (
      <span role="alert" className="mt-1 flex items-center gap-1 text-[11px] text-rose-600">
        <AlertTriangle className="h-3 w-3 shrink-0" /> {t(errors[k]!)}
      </span>
    ) : null;

  const num = (k: NormTaskField, title: string, hint: string) => (
    <label className="block">
      <span className={label}>{title}</span>
      <input
        inputMode="decimal"
        value={d[k]}
        onChange={(e) => set(k, e.target.value)}
        placeholder={hint}
        aria-invalid={Boolean(errors[k])}
        className={`${field} text-right font-mono tabular-nums ${errors[k] ? "border-rose-400" : ""}`}
      />
      <Err k={k} />
    </label>
  );

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
        aria-label={t("ADD NEW")}
        onSubmit={submit}
        noValidate
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#5c6633] bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-[#4b5320] px-4 py-3 text-[#e4e8dc]">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
              <Plus className="h-4 w-4" /> {t("ADD NEW")}
            </div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-[#c5d18a]">
              {t("New item for the Norm Set · linked to this take-off row")}
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

        <div className="grid grid-cols-2 gap-3 px-4 py-4">
          {failure ? (
            <div className="col-span-2 flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">{t("Nothing was added.")}</div>
                <div className="mt-0.5">{t(failure)}</div>
              </div>
            </div>
          ) : null}

          <label className="col-span-2 block">
            <span className={label}>{t("DESCRIPTION")} *</span>
            <input
              autoFocus
              value={d.task}
              onChange={(e) => set("task", e.target.value)}
              placeholder={t("e.g. Gypsum board ceiling, suspended")}
              aria-invalid={Boolean(errors.task)}
              className={`${field} ${errors.task ? "border-rose-400" : ""}`}
            />
            <Err k="task" />
          </label>

          <label className="block">
            <span className={label}>{t("TRADE")} *</span>
            <input
              list="add-norm-trades"
              value={d.trade}
              onChange={(e) => set("trade", e.target.value)}
              placeholder={t("Pick or type a trade")}
              aria-invalid={Boolean(errors.trade)}
              className={`${field} ${errors.trade ? "border-rose-400" : ""}`}
            />
            <datalist id="add-norm-trades">
              {trades.map((tr) => (
                <option key={tr} value={tr} />
              ))}
            </datalist>
            <Err k="trade" />
          </label>

          <label className="block">
            <span className={label}>{t("UNIT")} *</span>
            <select
              value={d.unit}
              onChange={(e) => set("unit", e.target.value)}
              aria-invalid={Boolean(errors.unit)}
              className={`${field} font-mono ${errors.unit ? "border-rose-400" : ""}`}
            >
              {ESTIMATE_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <Err k="unit" />
          </label>

          {num("laborNorm", t("LABOUR NORM (HRS / UNIT)"), "0")}
          <label className="block">
            <span className={label}>{t("CODE")}</span>
            <input
              value={d.code}
              onChange={(e) => set("code", e.target.value)}
              placeholder={t("Optional")}
              className={`${field} font-mono ${errors.code ? "border-rose-400" : ""}`}
            />
            <Err k="code" />
          </label>
          {num("materialUnitCost", t("MATERIAL / UNIT"), "0.00")}
          {num("equipmentUnitCost", t("EQUIPMENT / UNIT"), "0.00")}
          {num("subcontractUnitCost", t("SUBCONTRACT / UNIT"), "0.00")}

          <p className="col-span-2 text-[11px] leading-snug text-faint">
            {t("Saved to the firm’s Norm Set, so it is in the dropdown on every take-off and estimate from now on. Edit or remove it on the Norm Set tab.")}
          </p>
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
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#5c6633] bg-[#4b5320] px-3 text-sm font-semibold uppercase tracking-wide text-[#e4e8dc] shadow-sm hover:bg-[#3f4a1c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {busy ? t("Adding…") : t("Add and link")}
          </button>
        </div>
      </form>
    </div>
  );
}
