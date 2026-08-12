"use client";

import { useState, useTransition } from "react";
import { Check, AlertTriangle, Loader2, Lock } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { savePreferencesAction } from "@/app/(app)/settings/actions";
import { BACKGROUND_INTERVALS } from "@/lib/dashboard/backgrounds";
import type { Preferences } from "@/lib/data/settings";

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60";

function TextField({
  label, value, onChange, type = "text", hint, disabled,
}: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; hint?: string; disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
      {hint ? <span className="mt-1 block text-[11px] text-faint">{hint}</span> : null}
    </label>
  );
}

function ToggleField({
  label, hint, checked, onChange, disabled,
}: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-brand)] disabled:opacity-60"
      />
    </label>
  );
}

function SelectField({
  label, hint, value, options, onChange, disabled,
}: {
  label: string; hint?: string; value: number;
  options: ReadonlyArray<{ seconds: number; label: string }>;
  onChange: (v: number) => void; disabled?: boolean;
}) {
  return (
    <label className="flex items-start justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-9 shrink-0 rounded-lg border border-border bg-surface px-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
      >
        {options.map((o) => (
          <option key={o.seconds} value={o.seconds}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

/**
 * Per-user preferences editor. Controlled from the user's saved prefs (merged
 * over defaults server-side); Save persists to the signed-in user via the
 * `savePreferencesAction` server action. When `canSave` is false (no session),
 * the form is read-only with a sign-in prompt.
 */
export function PreferencesForm({
  preferences,
  canSave,
}: {
  preferences: Preferences;
  canSave: boolean;
}) {
  const [prefs, setPrefs] = useState<Preferences>(preferences);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Preferences>(key: K, val: Preferences[K]) => {
    setPrefs((p) => ({ ...p, [key]: val }));
    setSaved(false);
  };
  const num = (v: string) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await savePreferencesAction(prefs);
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  const disabled = !canSave || pending;

  return (
    <div className="space-y-5">
      {!canSave ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Lock className="h-4 w-4 shrink-0" />
          Sign in to save your preferences. These are stored per user.
        </div>
      ) : null}

      <Card>
        <CardHeader title="Defaults" subtitle="Applied to new proposals, projects, and documents." />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Default currency" value={prefs.defaultCurrency} onChange={(v) => set("defaultCurrency", v)} disabled={disabled} />
          <TextField label="Locale" value={prefs.locale} onChange={(v) => set("locale", v)} disabled={disabled} />
          <TextField label="Fiscal year start" value={prefs.fiscalYearStart} onChange={(v) => set("fiscalYearStart", v)} disabled={disabled} />
          <TextField label="VAT / Tax (%)" type="number" value={prefs.vatPercent} onChange={(v) => set("vatPercent", num(v))} disabled={disabled} />
          <TextField label="Proposal validity (days)" type="number" value={prefs.proposalValidityDays} onChange={(v) => set("proposalValidityDays", num(v))} disabled={disabled} />
          <TextField label="Project number format" value={prefs.projectNumberFormat} onChange={(v) => set("projectNumberFormat", v)} hint="Tokens: {YYYY} year · {seq} sequence" disabled={disabled} />
          <TextField label="Week starts on" value={prefs.weekStart} onChange={(v) => set("weekStart", v)} disabled={disabled} />
        </CardBody>

        <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-3">
          {saved ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
              <Check className="h-4 w-4" /> Saved
            </span>
          ) : null}
          {error ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" /> {error}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onSave}
            disabled={disabled}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Appearance" subtitle="How the app looks for you." />
        <CardBody className="divide-y divide-border py-0">
          <ToggleField label="Dashboard background" hint="Show a full-bleed architectural photo behind the dashboard; its cards turn translucent over it and the photo rotates on its own." checked={prefs.dashboardBackground} onChange={(v) => set("dashboardBackground", v)} disabled={disabled} />
          {/* Greyed out with the background off — a rotation speed for something
              that is not running is a control that lies. */}
          <SelectField label="Change background every" hint="How long each photo is held before it cross-fades to the next." value={prefs.dashboardBackgroundIntervalSeconds} options={BACKGROUND_INTERVALS} onChange={(v) => set("dashboardBackgroundIntervalSeconds", v)} disabled={disabled || !prefs.dashboardBackground} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Notifications" subtitle="Email alerts for your account." />
        <CardBody className="divide-y divide-border py-0">
          <ToggleField label="Proposal approved" hint="Notify the owner when a client approves a proposal." checked={prefs.notifyProposalApproved} onChange={(v) => set("notifyProposalApproved", v)} disabled={disabled} />
          <ToggleField label="Phase overdue" hint="Alert the project manager when a phase passes its end date." checked={prefs.notifyPhaseOverdue} onChange={(v) => set("notifyPhaseOverdue", v)} disabled={disabled} />
          <ToggleField label="Leave requests" hint="Notify approvers when staff submit leave requests." checked={prefs.notifyLeaveRequest} onChange={(v) => set("notifyLeaveRequest", v)} disabled={disabled} />
          <ToggleField label="Weekly digest" hint="Monday summary of pipeline, deadlines, and utilisation." checked={prefs.weeklyDigest} onChange={(v) => set("weeklyDigest", v)} disabled={disabled} />
        </CardBody>
      </Card>
    </div>
  );
}
