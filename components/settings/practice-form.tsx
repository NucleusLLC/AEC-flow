"use client";

import { useRef, useState, useTransition } from "react";
import { Check, AlertTriangle, Loader2, Lock, Upload, Trash2, ImageIcon, Coins } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import {
  savePracticeProfileAction,
  saveLogoAction,
  removeLogoAction,
  saveSystemCurrencyAction,
  saveFooterAction,
  saveLogoSettingsAction,
} from "@/app/(app)/settings/actions";
import type { PracticeProfile } from "@/lib/data/settings";
import type { FooterSettings, LogoSettings, LogoPosition } from "@/lib/server/practice-config";
import { currencyOptions } from "@/lib/format";

/**
 * Quick-pick shortcuts beside the System Currency field. The currently
 * configured currency is prepended by `currencyOptions`, so it is always
 * offered even on a tenant using a code that isn't listed here. Any 3-letter
 * ISO code can still be typed into the input.
 */
const OTHER_CURRENCIES = ["AWG", "AED", "USD", "EUR", "GBP", "SAR", "ANG", "COP"];

/** Print-safe font families for the document footer. */
const FOOTER_FONTS: { label: string; value: string }[] = [
  { label: "Default (sans-serif)", value: "" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Georgia (serif)", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Courier (monospace)", value: "'Courier New', Courier, monospace" },
  { label: "Segoe Script (cursive)", value: "'Segoe Script', cursive" },
  { label: "Brush Script (cursive)", value: "'Brush Script MT', 'Segoe Script', cursive" },
  { label: "Lucida Handwriting (cursive)", value: "'Lucida Handwriting', 'Segoe Script', cursive" },
  { label: "Ink Free (handwriting)", value: "'Ink Free', 'Segoe Script', cursive" },
];

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60";

function Field({
  label, value, onChange, type = "text", hint, disabled, className,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; hint?: string; disabled?: boolean; className?: string;
}) {
  return (
    <label className={className ?? "block"}>
      <span className="text-xs font-medium text-muted">{label}</span>
      <input type={type} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      {hint ? <span className="mt-1 block text-[11px] text-faint">{hint}</span> : null}
    </label>
  );
}

/** Max image size accepted by the file picker (kept under the server's data-URL ceiling). */
const MAX_FILE_BYTES = 1_000_000;

/**
 * Practice profile editor + logo upload. Profile persists to the org config file
 * via `savePracticeProfileAction`; the logo is read client-side as a data URL and
 * stored through `saveLogoAction`. Read-only with a sign-in prompt when !canSave.
 */
export function PracticeForm({
  profile,
  logoDataUrl,
  currency,
  footer,
  logoSettings,
  canSave,
  canEditFooter = false,
}: {
  profile: PracticeProfile;
  logoDataUrl: string | null;
  currency: string;
  footer: FooterSettings;
  logoSettings: LogoSettings;
  canSave: boolean;
  /** The document footer is app advertising — only the founder may edit it. */
  canEditFooter?: boolean;
}) {
  const [logoCfg, setLogoCfg] = useState<LogoSettings>(logoSettings);
  const [, startLogoCfg] = useTransition();
  const saveLogoCfg = (next: LogoSettings) => {
    setLogoCfg(next);
    startLogoCfg(async () => { await saveLogoSettingsAction(next); });
  };
  const [foot, setFoot] = useState<FooterSettings>(footer);
  const [footPending, startFoot] = useTransition();
  const [footMsg, setFootMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const saveFoot = (next: FooterSettings) => {
    setFoot(next);
    setFootMsg(null);
    startFoot(async () => {
      const res = await saveFooterAction(next);
      setFootMsg(res.ok ? { kind: "ok", text: "Footer saved." } : { kind: "err", text: res.error });
    });
  };
  const [form, setForm] = useState<PracticeProfile>(profile);
  const [logo, setLogo] = useState<string | null>(logoDataUrl);
  const [cur, setCur] = useState(currency);
  const [curPending, startCur] = useTransition();
  const [curMsg, setCurMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [logoPending, startLogo] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoMsg, setLogoMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function onSaveCurrency(next: string) {
    setCur(next);
    setCurMsg(null);
    startCur(async () => {
      const res = await saveSystemCurrencyAction(next);
      setCurMsg(res.ok ? { kind: "ok", text: `System currency set to ${next}.` } : { kind: "err", text: res.error });
    });
  }

  const disabled = !canSave || pending;

  const set = <K extends keyof PracticeProfile>(key: K, val: PracticeProfile[K]) => {
    setForm((p) => ({ ...p, [key]: val }));
    setSaved(false);
  };

  function onSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await savePracticeProfileAction(form);
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setLogoMsg(null);
    if (!file.type.startsWith("image/")) {
      setLogoMsg({ kind: "err", text: "Please choose an image file (PNG, JPG, or SVG)." });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setLogoMsg({ kind: "err", text: "Image is too large — please use one under 1 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      startLogo(async () => {
        const res = await saveLogoAction(dataUrl);
        if (res.ok) {
          setLogo(dataUrl);
          setLogoMsg({ kind: "ok", text: "Logo updated." });
        } else {
          setLogoMsg({ kind: "err", text: res.error });
        }
      });
    };
    reader.onerror = () => setLogoMsg({ kind: "err", text: "Could not read the file." });
    reader.readAsDataURL(file);
  }

  function onRemoveLogo() {
    setLogoMsg(null);
    startLogo(async () => {
      const res = await removeLogoAction();
      if (res.ok) {
        setLogo(null);
        setLogoMsg({ kind: "ok", text: "Logo removed." });
      } else {
        setLogoMsg({ kind: "err", text: res.error });
      }
    });
  }

  return (
    <div className="space-y-5">
      {!canSave ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Lock className="h-4 w-4 shrink-0" />
          Sign in to edit the practice profile.
        </div>
      ) : null}

      {/* Logo */}
      <Card>
        <CardHeader title="Practice Logo" subtitle="Shown on proposals, orders, and exported documents." />
        <CardBody className="flex flex-wrap items-center gap-5">
          <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URL of arbitrary size; next/image isn't a fit
              <img src={logo} alt="Practice logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <ImageIcon className="h-7 w-7 text-faint" />
            )}
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" onChange={onPickLogo} className="hidden" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={!canSave || logoPending}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {logoPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {logo ? "Replace logo" : "Upload logo"}
              </button>
              {logo ? (
                <button
                  type="button"
                  onClick={onRemoveLogo}
                  disabled={!canSave || logoPending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              ) : null}
            </div>
            <p className="text-[11px] text-faint">PNG, JPG, or SVG · up to 1 MB · landscape works best.</p>
            {logoMsg ? (
              <p className={logoMsg.kind === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-600"}>{logoMsg.text}</p>
            ) : null}
          </div>

          {/* Document logo placement — applies to every exported / printed document */}
          <div className="w-full border-t border-border pt-4">
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <span className="mb-1 block text-xs font-medium text-muted">Position on documents</span>
                <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
                  {(["left", "center", "right"] as LogoPosition[]).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      disabled={!canSave}
                      onClick={() => saveLogoCfg({ ...logoCfg, position: pos })}
                      className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors disabled:opacity-60 ${logoCfg.position === pos ? "bg-brand text-brand-fg" : "text-muted hover:text-fg"}`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted">Size — {logoCfg.size}px</span>
                <input
                  type="range"
                  min={24}
                  max={160}
                  step={2}
                  value={logoCfg.size}
                  disabled={!canSave}
                  onChange={(e) => saveLogoCfg({ ...logoCfg, size: Number(e.target.value) })}
                  className="w-48 accent-brand"
                />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-faint">Applies to every printed / PDF document — proposals, estimates, orders, schedule and meeting minutes.</p>
          </div>
        </CardBody>
      </Card>

      {/* System Currency */}
      <Card>
        <CardHeader title="System Currency" subtitle="Org-wide monetary unit — the default across every module. Per-record currencies still override." />
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-xs font-medium text-muted">Currency (3-letter ISO code)</span>
              <input
                value={cur}
                onChange={(e) => setCur(e.target.value.toUpperCase().slice(0, 3))}
                disabled={!canSave || curPending}
                placeholder={currency}
                className={inputCls + " w-32 uppercase tracking-wide"}
              />
            </label>
            <button
              type="button"
              onClick={() => onSaveCurrency(cur)}
              disabled={!canSave || curPending || cur.length !== 3}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {curPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />} Set currency
            </button>
            {curMsg ? (
              <span className={curMsg.kind === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-600"}>{curMsg.text}</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {currencyOptions(OTHER_CURRENCIES).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onSaveCurrency(c)}
                disabled={!canSave || curPending}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${cur === c ? "border-brand bg-brand/10 text-brand" : "border-border bg-surface text-muted hover:text-fg"}`}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-faint">
            Applies across estimates, proposals, orders, projects, construction admin and dashboards. Records saved with their own currency keep it.
          </p>
        </CardBody>
      </Card>

      {/* Document Footer */}
      <Card>
        <CardHeader title="Footer Text" subtitle="The line printed at the bottom of every page of exported documents — managed by AEC-flow." />
        <CardBody className="space-y-3">
          {!canEditFooter ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-xs text-muted">
              <Lock className="h-3.5 w-3.5 text-faint" />
              This footer is set by AEC-flow and can&apos;t be changed.
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-3">
            <label className="block min-w-[200px] flex-1">
              <span className="text-xs font-medium text-muted">Footer text</span>
              <input
                value={foot.text}
                onChange={(e) => setFoot({ ...foot, text: e.target.value })}
                disabled={!canEditFooter || footPending}
                placeholder="AEC Management Suite"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted">Font type</span>
              <select
                value={foot.fontFamily}
                onChange={(e) => setFoot({ ...foot, fontFamily: e.target.value })}
                disabled={!canEditFooter || footPending}
                className="mt-1 h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
                style={{ width: 190 }}
              >
                {FOOTER_FONTS.map((f) => (
                  <option key={f.label} value={f.value}>{f.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted">Font height (px)</span>
              <input
                type="number"
                min={5}
                max={24}
                value={foot.fontSize}
                onChange={(e) => setFoot({ ...foot, fontSize: Number(e.target.value) || 9 })}
                disabled={!canEditFooter || footPending}
                className="mt-1 h-9 w-24 rounded-lg border border-border bg-surface px-3 text-right text-sm tabular-nums text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
              />
            </label>
          </div>
          {/* Live preview — mirrors the printed footer (dotted rule above). */}
          <div className="rounded-lg border border-border bg-surface-2/40 px-3 py-2">
            <span className="text-[10px] uppercase tracking-wide text-faint">Preview</span>
            <div
              className="mt-1 flex items-center justify-between border-t border-dotted pt-1"
              style={{ borderColor: "#475569", fontFamily: foot.fontFamily || undefined, fontSize: foot.fontSize, color: "#475569" }}
            >
              <span>{foot.text || "—"}</span>
              <span>Page 1 of 4</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => saveFoot(foot)}
              disabled={!canEditFooter || footPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {footPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save footer
            </button>
            {footMsg ? (
              <span className={footMsg.kind === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-600"}>{footMsg.text}</span>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader title="Practice Profile" subtitle="Appears on proposals, orders, and exported documents." />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Practice name" value={form.name} onChange={(v) => set("name", v)} disabled={disabled} />
          <Field label="Legal name" value={form.legalName} onChange={(v) => set("legalName", v)} disabled={disabled} />
          <Field label="Tax Registration Number (TRN)" value={form.trn} onChange={(v) => set("trn", v)} disabled={disabled} />
          <Field label="Founded" value={form.founded} onChange={(v) => set("founded", v)} disabled={disabled} />
          <Field label="Address" value={form.addressLine} onChange={(v) => set("addressLine", v)} disabled={disabled} className="block sm:col-span-2" />
          <Field label="City" value={form.city} onChange={(v) => set("city", v)} disabled={disabled} />
          <Field label="State" value={form.emirate} onChange={(v) => set("emirate", v)} disabled={disabled} />
          <Field label="Phone" type="tel" value={form.phone} onChange={(v) => set("phone", v)} disabled={disabled} />
          <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} disabled={disabled} />
          <Field label="Website" value={form.website} onChange={(v) => set("website", v)} disabled={disabled} />
          <Field label="Country" value={form.country} onChange={(v) => set("country", v)} disabled={disabled} />
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
    </div>
  );
}
