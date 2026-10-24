import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import { practiceForPayment, resolvePayToken } from "@/lib/data/pay-now";
import { isPayTokenShape } from "@/lib/payments/pay-link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment received · AEC-flow",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Where Stripe Checkout returns the client after paying. It RECORDS NOTHING:
 * the payment is written by the signed webhook (app/api/stripe/webhook), which
 * is the only source of truth for money. A success URL can be opened by anyone
 * who has the link, so it must never be one.
 */
export default async function PaySuccessPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isPayTokenShape(token)) notFound();
  const hit = await resolvePayToken(token);
  if (!hit) notFound();
  const [practice, t] = await Promise.all([practiceForPayment(hit.companyId), getServerT()]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md rounded-[var(--radius-card)] border border-border bg-surface p-6 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <h1 className="mt-3 text-lg font-semibold text-fg">{t("Thank you — your payment was received.")}</h1>
        <p className="mt-2 text-sm text-muted">
          {fmt(t("{practice} will see it on the invoice within a few minutes."), {
            practice: practice.name,
          })}
        </p>
        <Link href={`/pay/${token}`} className="mt-5 inline-block text-sm text-brand hover:underline">
          {t("Back to the invoice")}
        </Link>
      </div>
    </main>
  );
}
