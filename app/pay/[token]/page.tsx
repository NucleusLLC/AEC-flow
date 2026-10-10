import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreditCard, CheckCircle2 } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import { getInvoice } from "@/lib/data/invoices";
import { practiceForPayment, resolvePayToken } from "@/lib/data/pay-now";
import { isCardCurrencySupported, isOnlinePayable, isPayTokenShape } from "@/lib/payments/pay-link";
import { companyOverride } from "@/lib/server/request-company";
import { militaryDate } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";

// Live balance, per request — never prerendered or cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pay invoice · AEC-flow",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * /pay/<token> — a practice's client pays an invoice by card. PUBLIC (proxy.ts):
 * the client has no AEC-flow account and never sees a login page.
 *
 * The token is the only key (lib/payments/pay-link.ts). The page shows the
 * invoice number, the practice, the due date and what is owed now — nothing a
 * client was not already sent on the invoice itself — and a Pay button that
 * POSTs to ./checkout, which opens Stripe Checkout on the PRACTICE's own Stripe
 * account.
 */
export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ cancelled?: string; error?: string; unavailable?: string; busy?: string }>;
}) {
  const { token } = await params;
  const q = await searchParams;
  if (!isPayTokenShape(token)) notFound();
  const hit = await resolvePayToken(token);
  if (!hit) notFound();
  // Before any scoped query: every read below is this practice's, nobody else's —
  // the same pattern as the office TV board (app/officedash/page.tsx).
  companyOverride().companyId = hit.companyId;

  const [invoice, practice, t] = await Promise.all([
    getInvoice(hit.invoiceId),
    practiceForPayment(hit.companyId),
    getServerT(),
  ]);
  if (!invoice) notFound();

  const money = (n: number) =>
    formatCurrency(n, invoice.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const payable =
    isOnlinePayable(invoice) && !!practice.stripeAccountId && isCardCurrencySupported(invoice.currency);
  const settled = invoice.status === "PAID" || invoice.status === "CREDITED";

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{practice.name}</p>
        <h1 className="mt-1 text-lg font-semibold text-fg">
          {t("Invoice")} <span className="font-mono">{invoice.number}</span>
        </h1>
        {invoice.dueDate ? (
          <p className="mt-0.5 text-xs text-muted">
            {t("Due")} <span className="font-mono">{militaryDate(invoice.dueDate)}</span>
          </p>
        ) : null}

        <div className="mt-6 rounded-lg border border-border bg-surface-2/50 px-4 py-3">
          <div className="text-xs text-muted">{t("Amount due")}</div>
          <div className="mt-0.5 font-mono text-2xl font-semibold text-fg">{money(invoice.outstanding)}</div>
          <div className="text-xs text-faint">{invoice.currency}</div>
        </div>

        {q.cancelled ? (
          <p className="mt-4 text-sm text-muted">{t("Payment cancelled. Nothing was charged.")}</p>
        ) : null}
        {q.error ? (
          <p className="mt-4 text-sm text-red-600">
            {t("Online payment could not be started. Please try again in a moment.")}
          </p>
        ) : null}
        {q.busy ? (
          <p className="mt-4 text-sm text-red-600">{t("Too many attempts. Please try again in a few minutes.")}</p>
        ) : null}

        {settled ? (
          <p className="mt-6 inline-flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> {t("This invoice has been paid. Thank you.")}
          </p>
        ) : payable ? (
          <form method="post" action={`/pay/${token}/checkout`} className="mt-6">
            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-fg transition-colors hover:bg-brand/90"
            >
              <CreditCard className="h-4 w-4" />
              {fmt(t("Pay {amount}"), { amount: money(invoice.outstanding) })}
            </button>
            <p className="mt-2 text-center text-[11px] text-faint">
              {fmt(t("Card payment by Stripe, paid directly to {practice}."), { practice: practice.name })}
            </p>
          </form>
        ) : (
          <p className="mt-6 text-sm text-muted">
            {fmt(t("Online payment is not available for this invoice. Please contact {practice}."), {
              practice: practice.name,
            })}
          </p>
        )}
      </div>
    </main>
  );
}
