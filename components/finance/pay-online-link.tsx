"use client";

/**
 * The invoice's "Pay online" link, to copy into a message to the client. Shown
 * only while the practice is connected to Stripe and the invoice still has money
 * owing (lib/data/pay-now.ts `payLinkFor`). The same link prints on the invoice.
 */
import { useState } from "react";
import { Check, Copy, CreditCard } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";

export function PayOnlineLink({ url }: { url: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card>
      <CardBody className="flex flex-wrap items-center gap-3">
        <CreditCard className="h-4 w-4 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-fg">{t("Pay online link")}</div>
          <div className="truncate font-mono text-xs text-muted" title={url}>
            {url}
          </div>
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          {copied ? t("Copied") : t("Copy link")}
        </button>
        <p className="w-full text-[11px] text-faint">
          {t("The client pays the amount owed by card, straight into your Stripe account. The payment is recorded here automatically.")}
        </p>
      </CardBody>
    </Card>
  );
}
