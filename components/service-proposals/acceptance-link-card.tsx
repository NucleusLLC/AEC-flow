"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, ShieldCheck, ThumbsDown, ThumbsUp, X } from "lucide-react";
import {
  createAcceptanceLinkAction,
  revokeAcceptanceLinkAction,
} from "@/app/(app)/design/service-proposals/actions";
import { EmailButton } from "@/components/email/email-button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { withAcceptanceLink } from "@/lib/proposals/acceptance-email";
import type { AcceptanceLinkSummary } from "@/lib/data/proposal-acceptance";

const btn =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-muted transition-colors hover:border-brand hover:text-fg disabled:opacity-50";

/** "2026-11-14 09:30 UTC" — the record is evidence, so the time zone is stated. */
function stamp(iso: string | null): string {
  return iso ? `${iso.slice(0, 16).replace("T", " ")} UTC` : "—";
}

/**
 * Client acceptance by secure link (Release C), on the proposal's detail page.
 *
 * Creates the link, shows it ONCE (only its hash is stored — a lost link is replaced, not
 * recovered), offers it through the existing Email button with the usual proposal email,
 * revokes it, and shows every answer the client gave through a link: who, in what
 * capacity, when, and from which address and browser.
 */
export function AcceptanceLinkCard({
  proposalId,
  canShare,
  links,
  email,
}: {
  proposalId: string;
  /** The proposal is awaiting the client (SENT / UNDER_CLIENT_REVIEW). */
  canShare: boolean;
  links: AcceptanceLinkSummary[];
  /** The page's existing proposal email, to which the link is added. */
  email: { subject: string; attachment: string; to: string; body: string };
}) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const active = links.find((l) => l.status === "active") ?? null;
  const answered = links.filter((l) => l.status === "answered");

  function create() {
    setError(null);
    start(async () => {
      const res = await createAcceptanceLinkAction(proposalId);
      if (res.ok) {
        setCreated({ url: res.url, expiresAt: res.expiresAt });
        setCopied(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function revoke(linkId: string) {
    setError(null);
    start(async () => {
      const res = await revokeAcceptanceLinkAction(proposalId, linkId);
      if (!res.ok) setError(res.error ?? t("Something went wrong."));
      setCreated(null);
      router.refresh();
    });
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (!canShare && links.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title={t("Client acceptance link")}
        subtitle={t("A private link for the client to read this proposal and accept or decline it online — no account needed.")}
      />
      <CardBody className="space-y-4 text-sm">
        {created ? (
          <div className="space-y-2 rounded-lg border border-emerald-300 bg-emerald-50/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                readOnly
                value={created.url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label={t("Client acceptance link")}
                className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2 font-mono text-xs text-fg"
              />
              <button type="button" onClick={copy} className={btn}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t("Copied") : t("Copy")}
              </button>
              <EmailButton
                label={t("Email link")}
                subject={email.subject}
                attachment={email.attachment}
                defaultTo={email.to}
                defaultBody={withAcceptanceLink(email.body, created.url, created.expiresAt.slice(0, 10))}
                relatedType="service-proposal"
                relatedId={proposalId}
              />
            </div>
            <p className="text-xs text-emerald-800">
              {t("Copy it now: for security the link is shown only once. If it is lost, create a new one.")}
            </p>
          </div>
        ) : null}

        {active ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-muted">
              <span className="inline-flex items-center gap-1.5 font-medium text-fg">
                <Link2 className="h-4 w-4" /> {t("Link active")}
              </span>
              <span className="ml-2 text-xs">
                {fmt(t("Created {date}"), { date: stamp(active.createdAt) })}
                {active.createdByName ? ` · ${active.createdByName}` : ""}
                {" · "}
                {fmt(t("expires {date}"), { date: active.expiresAt.slice(0, 10) })}
              </span>
            </div>
            <button type="button" onClick={() => revoke(active.id)} disabled={pending} className={btn}>
              <X className="h-4 w-4" /> {t("Revoke link")}
            </button>
          </div>
        ) : null}

        {canShare ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={create} disabled={pending} className={btn}>
              <Link2 className="h-4 w-4" /> {active ? t("Create a new link") : t("Create link")}
            </button>
            {active ? (
              <span className="text-xs text-muted">{t("A new link replaces the active one.")}</span>
            ) : null}
          </div>
        ) : answered.length === 0 ? (
          <p className="text-xs text-muted">
            {t("Links stop working once the proposal is no longer awaiting the client’s answer.")}
          </p>
        ) : null}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {answered.length > 0 ? (
          <div className="space-y-3 border-t border-border pt-3">
            {answered.map((a) => (
              <div key={a.id} className="space-y-1">
                <div className="flex items-center gap-1.5 font-medium text-fg">
                  {a.decision === "ACCEPTED" ? (
                    <ThumbsUp className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ThumbsDown className="h-4 w-4 text-rose-600" />
                  )}
                  {a.decision === "ACCEPTED" ? t("Accepted by the client") : t("Declined by the client")}
                  {a.versionLabel ? <span className="text-xs font-normal text-muted">· v{a.versionLabel}</span> : null}
                </div>
                <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-0.5 text-xs">
                  <dt className="text-muted">{t("Name")}</dt>
                  <dd className="text-fg">{a.signerName || "—"}</dd>
                  {a.signerTitle ? (
                    <>
                      <dt className="text-muted">{t("Position")}</dt>
                      <dd className="text-fg">{a.signerTitle}</dd>
                    </>
                  ) : null}
                  {a.signerCompany ? (
                    <>
                      <dt className="text-muted">{t("Company")}</dt>
                      <dd className="text-fg">{a.signerCompany}</dd>
                    </>
                  ) : null}
                  {a.signature ? (
                    <>
                      <dt className="text-muted">{t("Signature")}</dt>
                      <dd className="font-serif italic text-fg">{a.signature}</dd>
                    </>
                  ) : null}
                  {a.declineReason ? (
                    <>
                      <dt className="text-muted">{t("Reason")}</dt>
                      <dd className="whitespace-pre-wrap text-fg">{a.declineReason}</dd>
                    </>
                  ) : null}
                  <dt className="text-muted">{t("When")}</dt>
                  <dd className="text-fg">{stamp(a.decidedAt)}</dd>
                  <dt className="text-muted">{t("From")}</dt>
                  <dd className="break-all text-faint">
                    {a.decisionIp || "—"}
                    {a.decisionUserAgent ? ` · ${a.decisionUserAgent}` : ""}
                  </dd>
                </dl>
              </div>
            ))}
            <p className="inline-flex items-center gap-1.5 text-xs text-muted">
              <ShieldCheck className="h-3.5 w-3.5" />
              {t("Recorded when the client answered through the link; the status history shows the same change.")}
            </p>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
