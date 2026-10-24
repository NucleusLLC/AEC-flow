"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useT } from "@/components/i18n/language-provider";

/**
 * Across the top of the app when the practice's AEC-flow subscription is past
 * due or canceled. It tells, it never blocks (BILLING_ENFORCED is false). Hidden
 * for the page view by the ×; it returns on the next load while the status stands.
 * The link to Settings › Billing is for those who can act on it.
 */
export function BillingBanner({ kind, canManage }: { kind: "past_due" | "canceled"; canManage: boolean }) {
  const t = useT();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-fg">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
      <span className="min-w-0">
        {kind === "past_due"
          ? t("Your practice's AEC-flow payment is past due.")
          : t("Your practice's AEC-flow subscription has ended.")}{" "}
        {canManage ? (
          <Link href="/settings/billing" className="font-medium text-brand hover:underline">
            {t("Billing")}
          </Link>
        ) : (
          t("Please let an administrator or director know.")
        )}
      </span>
      <button
        type="button"
        onClick={() => setHidden(true)}
        aria-label={t("Hide until next time")}
        className="ml-auto shrink-0 rounded p-1 hover:bg-amber-500/20"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
