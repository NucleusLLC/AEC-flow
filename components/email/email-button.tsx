"use client";

import { useEffect, useState } from "react";
import { Mail, X, Paperclip, Send, Check } from "lucide-react";
import { firmName } from "@/lib/firm-identity";

/**
 * Reusable "Email …" button + compose dialog. Drop into any module to email an
 * artifact (estimate, form, drawing, report, schedule…). Placeholder send —
 * logs the payload; real delivery goes live with the email service (Resend) +
 * database. The UI/shape stays the same when it's wired.
 */
export function EmailButton({
  subject,
  attachment,
  defaultTo = "",
  defaultBody,
  variant = "button",
  label = "Email",
  className = "",
}: {
  subject: string;
  attachment: string;
  defaultTo?: string;
  defaultBody?: string;
  variant?: "button" | "ghost" | "icon";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const base =
    variant === "button"
      ? "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
      : variant === "ghost"
        ? "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-muted hover:text-fg"
        : "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-muted hover:text-fg";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${base} ${className}`} aria-label={`Email ${attachment}`} title={`Email ${attachment}`}>
        <Mail className="h-4 w-4" />
        {variant !== "icon" ? label : null}
      </button>
      {open ? (
        <EmailDialog subject={subject} attachment={attachment} defaultTo={defaultTo} defaultBody={defaultBody} onClose={() => setOpen(false)} />
      ) : null}
    </>
  );
}

function EmailDialog({
  subject,
  attachment,
  defaultTo,
  defaultBody,
  onClose,
}: {
  subject: string;
  attachment: string;
  defaultTo: string;
  defaultBody?: string;
  onClose: () => void;
}) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subj, setSubj] = useState(subject);
  const [msg, setMsg] = useState(
    defaultBody ?? `Dear recipient,\n\nPlease find attached ${attachment}.\n\nKind regards,\n${firmName()}`,
  );
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const valid = /\S+@\S+\.\S+/.test(to);
  const send = () => {
    console.log("[email:send]", { to, cc, subject: subj, message: msg, attachment });
    setSent(true);
    const t = setTimeout(onClose, 1400);
    return () => clearTimeout(t);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-fg"><Mail className="h-4 w-4 text-brand" /> Email document</div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-faint hover:text-fg"><X className="h-4 w-4" /></button>
        </div>

        {sent ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-6 w-6" /></span>
            <div className="text-sm font-semibold text-fg">Queued to {to}</div>
            <div className="text-xs text-muted">Delivery goes live with the email service — the message and attachment are captured.</div>
          </div>
        ) : (
          <>
            <div className="space-y-3 px-4 py-4">
              <Row label="To">
                <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@client.com" type="email" className={inp} />
              </Row>
              <Row label="Cc">
                <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="optional" className={inp} />
              </Row>
              <Row label="Subject">
                <input value={subj} onChange={(e) => setSubj(e.target.value)} className={inp} />
              </Row>
              <Row label="Message">
                <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={5} className={`${inp} resize-y`} />
              </Row>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-xs text-muted">
                <Paperclip className="h-3.5 w-3.5 text-faint" /> <span className="font-medium text-fg">{attachment}</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
              <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted hover:text-fg">Cancel</button>
              <button type="button" onClick={send} disabled={!valid} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40">
                <Send className="h-4 w-4" /> Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none focus:ring-1 focus:ring-brand/30";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[64px_1fr] items-start gap-3">
      <span className="pt-2 text-xs font-medium uppercase tracking-wide text-faint">{label}</span>
      {children}
    </label>
  );
}
