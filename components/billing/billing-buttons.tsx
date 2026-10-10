"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { openPortalAction, startCheckoutAction } from "@/app/(app)/settings/billing/actions";
import { useT } from "@/components/i18n/language-provider";

/**
 * Subscribe (monthly / yearly) → Stripe Checkout; Manage billing → Stripe
 * Customer Portal. Both are Stripe-hosted pages: the server action returns the
 * URL and the browser goes there.
 */
export function BillingButtons({
  canSubscribe,
  hasYearly,
  canManage,
}: {
  canSubscribe: boolean;
  hasYearly: boolean;
  canManage: boolean;
}) {
  const t = useT();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = (key: string, run: () => Promise<{ ok: true; url: string } | { ok: false; error: string }>) =>
    start(async () => {
      setError(null);
      setBusy(key);
      const res = await run();
      if (res.ok) {
        window.location.assign(res.url);
      } else {
        setError(res.error);
        setBusy(null);
      }
    });

  const primary =
    "inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-fg hover:bg-brand/90 disabled:opacity-50";
  const secondary =
    "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-fg hover:border-brand disabled:opacity-50";
  const spin = (key: string) => (pending && busy === key ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null);

  return (
    <div className="mt-5 space-y-2">
      <div className="flex flex-wrap gap-2">
        {canSubscribe ? (
          <>
            <button type="button" disabled={pending} className={primary} onClick={() => go("monthly", () => startCheckoutAction("monthly"))}>
              {spin("monthly")} {hasYearly ? t("Subscribe monthly") : t("Subscribe")}
            </button>
            {hasYearly ? (
              <button type="button" disabled={pending} className={primary} onClick={() => go("yearly", () => startCheckoutAction("yearly"))}>
                {spin("yearly")} {t("Subscribe yearly")}
              </button>
            ) : null}
          </>
        ) : null}
        {canManage ? (
          <button type="button" disabled={pending} className={secondary} onClick={() => go("portal", openPortalAction)}>
            {spin("portal")} {t("Manage billing")} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-red-700 dark:text-red-300">{t(error)}</p> : null}
    </div>
  );
}
