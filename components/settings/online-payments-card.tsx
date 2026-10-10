"use client";

/**
 * Settings → Integrations → Online payments. Connect the practice's OWN Stripe
 * account so clients can pay invoices by card; the money goes to the practice.
 * Server side: app/(app)/settings/stripe-actions.ts. Owner setup:
 * docs/finance/STRIPE.md.
 */
import { useState, useTransition } from "react";
import { Check, CreditCard, RefreshCw, Unplug, X } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { OnlinePaymentsStatus } from "@/lib/data/pay-now";
import {
  disconnectStripeAction,
  refreshStripeStatusAction,
  startStripeOnboardingAction,
} from "@/app/(app)/settings/stripe-actions";

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60";

export function OnlinePaymentsCard({
  initial,
  canManage,
  notice,
}: {
  initial: OnlinePaymentsStatus;
  canManage: boolean;
  /** `?stripe=` on return from Stripe's onboarding. */
  notice?: "returned" | "error" | null;
}) {
  const t = useT();
  const [status, setStatus] = useState(initial);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    notice === "error" ? { kind: "err", text: "Could not read the Stripe account." } : null,
  );
  const [confirming, setConfirming] = useState(false);
  const [busy, start] = useTransition();

  const connect = () =>
    start(async () => {
      setMsg(null);
      const res = await startStripeOnboardingAction();
      if (res.ok) window.location.assign(res.data.url);
      else setMsg({ kind: "err", text: res.error });
    });

  const refresh = () =>
    start(async () => {
      setMsg(null);
      const res = await refreshStripeStatusAction();
      if (res.ok) setStatus(res.data);
      else setMsg({ kind: "err", text: res.error });
    });

  const disconnect = () =>
    start(async () => {
      setMsg(null);
      const res = await disconnectStripeAction();
      setConfirming(false);
      if (res.ok) {
        setStatus(res.data);
        setMsg({ kind: "ok", text: "Stripe disconnected. Invoices no longer offer online payment." });
      } else setMsg({ kind: "err", text: res.error });
    });

  const connected = !!status.accountId;
  const ready = connected && status.chargesEnabled;

  return (
    <Card>
      <CardHeader
        title={t("Online payments")}
        subtitle={t("Let clients pay invoices by card through your own Stripe account. The money goes straight to your practice.")}
      />
      <CardBody className="space-y-4">
        {!status.configured ? (
          <p className="text-sm text-muted">{t("Online payments are not set up on this server yet.")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2/50 px-4 py-3">
              <CreditCard className="h-4 w-4 shrink-0 text-brand" />
              {connected ? (
                <span className="inline-flex flex-wrap items-center gap-2 text-sm text-fg">
                  {ready ? <Check className="h-4 w-4 text-emerald-600" /> : <X className="h-4 w-4 text-amber-600" />}
                  {ready ? t("Connected — clients can pay by card") : t("Stripe onboarding is not finished")}
                  <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-muted">{status.accountId}</code>
                  <Badge tone={status.chargesEnabled ? "green" : "amber"}>
                    {t("Charges")}: {status.chargesEnabled ? t("on") : t("off")}
                  </Badge>
                  <Badge tone={status.payoutsEnabled ? "green" : "amber"}>
                    {t("Payouts")}: {status.payoutsEnabled ? t("on") : t("off")}
                  </Badge>
                </span>
              ) : (
                <span className="text-sm text-muted">{t("Not connected — invoices show no Pay online link.")}</span>
              )}
            </div>

            {!canManage ? (
              <p className="text-xs text-muted">{t("Only an Admin or a Director can change the practice's settings.")}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {!ready ? (
                  <button
                    type="button"
                    onClick={connect}
                    disabled={busy}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
                  >
                    <CreditCard className="h-4 w-4" />
                    {connected ? t("Continue Stripe onboarding") : t("Connect Stripe")}
                  </button>
                ) : null}
                {connected ? (
                  <button type="button" onClick={refresh} disabled={busy} className={BTN}>
                    <RefreshCw className="h-4 w-4" /> {t("Check status")}
                  </button>
                ) : null}
                {connected && !confirming ? (
                  <button type="button" onClick={() => setConfirming(true)} disabled={busy} className={cn(BTN, "text-red-600")}>
                    <Unplug className="h-4 w-4" /> {t("Disconnect")}
                  </button>
                ) : null}
                {confirming ? (
                  <span className="inline-flex flex-wrap items-center gap-2 text-sm text-fg">
                    {t("Stop offering online payment? Your Stripe account itself is not touched.")}
                    <button
                      type="button"
                      onClick={disconnect}
                      disabled={busy}
                      className="inline-flex h-9 items-center rounded-lg bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-600/90 disabled:opacity-60"
                    >
                      {t("Disconnect")}
                    </button>
                    <button type="button" onClick={() => setConfirming(false)} className={BTN}>
                      {t("Cancel")}
                    </button>
                  </span>
                ) : null}
              </div>
            )}
            <p className="text-[11px] text-faint">
              {t("Stripe charges its own card fees to your Stripe account. AEC-flow takes no fee.")}
            </p>
          </>
        )}
        {msg ? (
          <p className={cn("text-sm", msg.kind === "ok" ? "text-emerald-700" : "text-red-600")}>{t(msg.text)}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
