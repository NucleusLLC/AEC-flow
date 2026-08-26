"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, X, Paperclip, Send, Check, AlertTriangle, Loader2, History, ExternalLink, Copy } from "lucide-react";
import { firmName } from "@/lib/firm-identity";
import { NOT_ATTACHED } from "@/lib/email/compose";
import { sendDocumentEmailAction, listEmailHistoryAction, type EmailHistory } from "@/app/(app)/email/actions";
import type { SendDocumentEmailResult } from "@/lib/server/document-email";

/**
 * Reusable "Email …" button + compose dialog. Drop into any module to email an
 * artifact (estimate, form, drawing, report, schedule…).
 *
 * ─── HOW IT SENDS ────────────────────────────────────────────────────────────
 * The SERVER sends it, through Resend, and writes a row recording the attempt
 * either way. This component's only jobs are to compose the message and to
 * report back exactly what the server was told by the provider.
 *
 * It has had two previous behaviours, and both are the reason the code below is
 * written the way it is:
 *
 *   1. It `console.log`ged the payload and showed a green "Queued" tick. A
 *      programme was reported as sent to a client and to the owner and never
 *      left the building. Nothing anywhere recorded it.
 *   2. It handed off to `mailto:`. Honest, but inert for anyone on webmail with
 *      no desktop mail client registered — which is the owner, so for him the
 *      button simply did nothing at all.
 *
 * So: the success panel is rendered only for `res.ok`, which the server returns
 * only when Resend returned a message id, and it names the recipient it was
 * confirmed for. Any failure keeps the composed message on screen — nothing the
 * user typed is ever thrown away by a failed send — and offers the `mailto:`
 * handoff as an escape hatch, now labelled as one rather than presented as the
 * send having worked.
 *
 * ─── ATTACHMENTS ─────────────────────────────────────────────────────────────
 * There are none, and the panel says so. AEC-flow's documents are produced by
 * the browser's print dialog, so no file exists on the server to attach and
 * there is no PDF library in the stack to make one. Naming the document while
 * implying it is enclosed would be the same lie as the green tick.
 */
export function EmailButton({
  subject,
  attachment,
  defaultTo = "",
  defaultBody,
  variant = "button",
  label = "Email",
  className = "",
  relatedType,
  relatedId,
  linkPath,
}: {
  subject: string;
  attachment: string;
  defaultTo?: string;
  defaultBody?: string;
  variant?: "button" | "ghost" | "icon";
  label?: string;
  className?: string;
  /**
   * What this email is about — `"schedule"`, `"estimate"`, `"drawing"` … Used to
   * group the Sent history. Optional: a caller that passes neither of these gets
   * a history keyed by the document's own name (see `relKey` below), which is
   * still a per-document history and needs no change in a protected module.
   */
  relatedType?: string;
  relatedId?: string;
  /**
   * Same-origin path to the document in the app, e.g. `/print/schedule/abc`.
   * Included in the message as a sign-in-required link — useful to a colleague,
   * useless to a client. Anything that is not a plain path is dropped server-side.
   */
  linkPath?: string;
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
        <EmailDialog
          subject={subject}
          attachment={attachment}
          defaultTo={defaultTo}
          defaultBody={defaultBody}
          relatedType={relatedType}
          relatedId={relatedId}
          linkPath={linkPath}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

type Phase = "compose" | "sending" | "sent";

function EmailDialog({
  subject,
  attachment,
  defaultTo,
  defaultBody,
  relatedType,
  relatedId,
  linkPath,
  onClose,
}: {
  subject: string;
  attachment: string;
  defaultTo: string;
  defaultBody?: string;
  relatedType?: string;
  relatedId?: string;
  linkPath?: string;
  onClose: () => void;
}) {
  const [to, setTo] = useState(defaultTo);
  const [cc, setCc] = useState("");
  const [subj, setSubj] = useState(subject);
  const [msg, setMsg] = useState(
    defaultBody ?? `Dear recipient,\n\nPlease find attached ${attachment}.\n\nKind regards,\n${firmName()}`,
  );
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState<Phase>("compose");
  /** The confirmed send. Set ONLY from a server result with `ok: true`. */
  const [confirmed, setConfirmed] = useState<Extract<SendDocumentEmailResult, { ok: true }> | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [history, setHistory] = useState<EmailHistory | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  /**
   * The history key. When the module did not name an entity, the document's own
   * name is the entity — every "Villa Verde — Schedule.pdf" send groups together.
   */
  const relType = relatedType ?? "document";
  const relId = relatedId ?? attachment;

  const loadHistory = useCallback(() => {
    listEmailHistoryAction({ relatedType: relType, relatedId: relId, limit: 10 })
      .then(setHistory)
      .catch(() => setHistory({ entries: [], companyWide: false }));
  }, [relType, relId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "sending") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  // A first-pass check only, so the Send button is not live on obvious nonsense.
  // The authoritative validation is server-side (lib/email/recipients.ts) — this
  // one runs in a browser the server does not control and proves nothing.
  const valid = /\S+@\S+\.\S+/.test(to.trim());

  const send = async () => {
    setPhase("sending");
    setFailure(null);
    let res: SendDocumentEmailResult;
    try {
      res = await sendDocumentEmailAction({
        to,
        cc,
        subject: subj,
        body: msg,
        documentName: attachment,
        relatedType: relType,
        relatedId: relId,
        linkPath: linkPath ?? null,
      });
    } catch (e) {
      // The action itself failed to complete (network, redeploy mid-flight). We
      // do not know whether anything was sent, so we must not say either way.
      setFailure(
        e instanceof Error && e.message
          ? `The send could not be completed: ${e.message}`
          : "The send could not be completed — the server did not answer.",
      );
      setPhase("compose");
      loadHistory();
      return;
    }
    if (res.ok) {
      setConfirmed(res);
      setPhase("sent");
    } else {
      // Everything the user typed stays exactly where it is.
      setFailure(res.error);
      setPhase("compose");
    }
    loadHistory();
  };

  /** The escape hatch: hand the composed message to a desktop mail client. */
  const openInMailClient = () => {
    const params = new URLSearchParams();
    if (cc.trim()) params.set("cc", cc.trim());
    params.set("subject", subj);
    params.set("body", `${msg}\n\n---\nPlease attach: ${attachment}`);
    window.location.href = `mailto:${encodeURIComponent(to.trim())}?${params.toString().replace(/\+/g, "%20")}`;
  };

  /* MORE ESCAPE HATCHES. `mailto:` only works when a DESKTOP mail client is
   * registered. On a machine whose mail lives in a browser tab, clicking it appears
   * to do nothing at all — which is exactly how this looked to the owner. Gmail and
   * Outlook on the web take the same composed message through a compose URL, and
   * copying works anywhere. Same text in every case; only the destination differs. */
  const composedBody = () => msg + "\n\n---\nPlease attach: " + attachment;

  const openInGmail = () => {
    const g = new URLSearchParams({ view: "cm", fs: "1", to: to.trim(), su: subj, body: composedBody() });
    if (cc.trim()) g.set("cc", cc.trim());
    window.open("https://mail.google.com/mail/?" + g.toString(), "_blank", "noopener,noreferrer");
  };

  const openInOutlook = () => {
    const o = new URLSearchParams({ to: to.trim(), subject: subj, body: composedBody() });
    if (cc.trim()) o.set("cc", cc.trim());
    window.open("https://outlook.office.com/mail/deeplink/compose?" + o.toString(), "_blank", "noopener,noreferrer");
  };

  const copyMessage = async () => {
    const header = "To: " + to + (cc.trim() ? "\nCc: " + cc : "") + "\nSubject: " + subj;
    try {
      await navigator.clipboard.writeText(header + "\n\n" + composedBody());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard blocked (permissions, insecure context). The text is still on
       * screen in the fields above, so this is a convenience and not the only route. */
    }
  };

  const busy = phase === "sending";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-fg"><Mail className="h-4 w-4 text-brand" /> Email document</div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-faint hover:text-fg disabled:opacity-40"><X className="h-4 w-4" /></button>
        </div>

        {phase === "sent" && confirmed ? (
          /* Rendered only for a server result with ok: true — i.e. only when the
             provider returned a message id. There is no other path to this panel. */
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-6 w-6" /></span>
            <div className="text-sm font-semibold text-fg">Sent to {confirmed.to}</div>
            {confirmed.cc.length > 0 ? (
              <div className="text-xs text-muted">Copied to {confirmed.cc.join(", ")}</div>
            ) : null}
            <div className="text-xs text-muted">
              The email provider accepted it and returned reference{" "}
              <span className="font-mono text-[11px] text-fg">{confirmed.messageId}</span>.
              <br />
              <span className="font-medium text-fg">{attachment}</span> was named in the message but not attached.
            </div>
            {confirmed.logId === null ? (
              <div className="mt-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                The message went out, but it could not be written to the email log.
              </div>
            ) : null}
            <button type="button" onClick={onClose} className="mt-3 inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2">Close</button>
          </div>
        ) : (
          <>
            <div className="space-y-3 px-4 py-4">
              {failure ? (
                <div className="flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">Not sent.</div>
                    <div className="mt-0.5">{failure}</div>
                    <div className="mt-1 text-rose-700">
                      Your message is still here — nothing was lost. Fix the problem and send again, or use one of
                      the mailbox buttons below. The attempt has been recorded in the email log either way.
                    </div>
                  </div>
                </div>
              ) : null}

              <Row label="To">
                <input value={to} onChange={(e) => setTo(e.target.value)} disabled={busy} placeholder="name@client.com" type="email" className={inp} />
              </Row>
              <Row label="Cc">
                <input value={cc} onChange={(e) => setCc(e.target.value)} disabled={busy} placeholder="optional — comma separated" className={inp} />
              </Row>
              <Row label="Subject">
                <input value={subj} onChange={(e) => setSubj(e.target.value)} disabled={busy} className={inp} />
              </Row>
              <Row label="Message">
                <textarea value={msg} onChange={(e) => setMsg(e.target.value)} disabled={busy} rows={5} className={`${inp} resize-y`} />
              </Row>

              {/* What is and is not in the email, stated where it is being composed. */}
              <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-xs text-muted">
                <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0 text-faint" />
                <span>
                  <span className="font-medium text-fg">Sent:</span> your message above, naming{" "}
                  <span className="font-medium text-fg">{attachment}</span>
                  {linkPath ? ", plus a link to it in AEC-flow (the recipient must be able to sign in)" : ""}.
                  <br />
                  <span className="font-medium text-fg">Not sent:</span> {NOT_ATTACHED}
                </span>
              </div>

              {/* SEND IT YOURSELF. Server-side delivery needs a configured provider;
                * until then — and afterwards, whenever it fails — these four routes
                * carry the SAME composed text into whatever the sender actually uses.
                * `mailto:` alone was not enough: on a machine with no desktop mail
                * client registered it silently does nothing, which is exactly what the
                * owner saw. Gmail and Outlook cover the web mailboxes; Copy covers
                * every other one. */}
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2">
                <span className="text-xs font-medium text-muted">Or send it from your own mailbox:</span>
                <button type="button" onClick={openInGmail} className={hatch} title="Opens a Gmail compose window with this message already filled in.">
                  <ExternalLink className="h-3.5 w-3.5" /> Gmail
                </button>
                <button type="button" onClick={openInOutlook} className={hatch} title="Opens an Outlook on the web compose window with this message already filled in.">
                  <ExternalLink className="h-3.5 w-3.5" /> Outlook
                </button>
                <button type="button" onClick={openInMailClient} className={hatch} title="Hands the message to a desktop mail client. Does nothing if none is installed.">
                  <Mail className="h-3.5 w-3.5" /> Mail app
                </button>
                <button type="button" onClick={copyMessage} className={hatch} title="Copies the recipients, subject and message so you can paste them anywhere.">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <span className="w-full text-[11px] leading-snug text-faint">
                  Attach {attachment} yourself — print it to PDF from its Print/Preview screen first.
                </span>
              </div>

              <EmailHistoryPanel
                history={history}
                open={showHistory}
                onToggle={() => setShowHistory((v) => !v)}
                attachment={attachment}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3">
              <button type="button" onClick={onClose} disabled={busy} className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted hover:text-fg disabled:opacity-40">Cancel</button>
              <button type="button" onClick={send} disabled={!valid || busy} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {busy ? "Sending…" : failure ? "Send again" : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * The record, where the person who sent it will look for it: in the same dialog,
 * under the message. Failures are listed alongside successes, because "did it go
 * out" is the question, and a list of successes only is what made the original
 * incident invisible.
 */
function EmailHistoryPanel({
  history,
  open,
  onToggle,
  attachment,
}: {
  history: EmailHistory | null;
  open: boolean;
  onToggle: () => void;
  attachment: string;
}) {
  const count = history?.entries.length ?? 0;
  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted hover:text-fg"
      >
        <History className="h-3.5 w-3.5 text-faint" />
        Sent history for {attachment}
        <span className="ml-auto text-faint">{history === null ? "…" : count === 0 ? "none yet" : `${count}`}</span>
      </button>
      {open ? (
        <div className="border-t border-border px-3 py-2">
          {history === null ? (
            <div className="py-1 text-xs text-faint">Loading…</div>
          ) : count === 0 ? (
            <div className="py-1 text-xs text-faint">Nothing has been emailed for this document yet.</div>
          ) : (
            <ul className="space-y-2">
              {history.entries.map((e) => (
                <li key={e.id} className="flex items-start gap-2 text-xs">
                  <span
                    className={`mt-0.5 inline-flex h-4 shrink-0 items-center rounded px-1.5 text-[10px] font-semibold ${
                      e.status === "SENT" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {e.status}
                  </span>
                  <span className="min-w-0">
                    <span className="text-fg">{e.to}</span>
                    {e.cc.length > 0 ? <span className="text-faint"> +{e.cc.length} cc</span> : null}
                    <span className="text-faint"> · {new Date(e.createdAt).toLocaleString()}</span>
                    {e.status === "FAILED" && e.error ? (
                      <span className="block text-rose-700">{e.error}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <a href="/email" className="mt-2 inline-block text-xs font-medium text-brand hover:underline">
            All sent email →
          </a>
        </div>
      ) : null}
    </div>
  );
}

const inp = "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg outline-none focus:ring-1 focus:ring-brand/30 disabled:opacity-60";

const hatch =
  "inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-xs font-medium text-muted transition-colors hover:text-fg";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[64px_1fr] items-start gap-3">
      <span className="pt-2 text-xs font-medium uppercase tracking-wide text-faint">{label}</span>
      {children}
    </label>
  );
}
