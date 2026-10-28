import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import { notFound } from "next/navigation";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { PrintSurface } from "@/components/print/print-surface";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { getReceipt } from "@/lib/data/invoices";
import { creditsOf, invoiceBalance } from "@/lib/finance/calc";
import { militaryDate } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/finance/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Receipt")} · ${t("Print")}` };
}

/**
 * A payment receipt on one A4 sheet: the RCT number, who paid, how much, how,
 * against which invoice, and what that invoice still owes now. Same shell as
 * the invoice print (letterhead, PrintSurface "Page N of M" footer).
 *
 * A payment recorded before receipts were numbered is numbered the first time
 * this page opens (lib/data/invoices.ts `getReceipt`). A REVERSED payment's
 * receipt says so across the top, with the reason and the date, and its amount
 * is struck through: it is a record of what happened, not proof of payment.
 */
export default async function ReceiptPrintPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = await params;
  const [found, practice, firm] = await Promise.all([getReceipt(paymentId), getPracticeSettings(), getFirmIdentity()]);
  if (!found) notFound();
  const { payment, invoice } = found;
  const t = await getServerT();
  const number = payment.receiptNumber ?? payment.id;

  const money = (n: number) =>
    formatCurrency(n, invoice.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { outstanding } = invoiceBalance({
    total: invoice.total,
    currency: invoice.currency,
    payments: invoice.payments,
    credits: creditsOf(invoice.creditNotes),
  });

  const facts: [string, string, boolean?][] = [
    [t("Receipt number"), number, true],
    [t("Received on"), militaryDate(payment.paidAt), true],
    [t("Method"), t(PAYMENT_METHOD_LABEL[payment.method])],
    [t("Reference"), payment.reference ?? "—", true],
    [t("Invoice"), invoice.number, true],
    [t("Invoice total"), money(invoice.total), true],
    [t("Balance due"), money(outstanding), true],
  ];

  return (
    <PrintSurface backHref={`/finance/invoices/${invoice.id}`} backLabel={invoice.number}>
      <DocumentLetterhead
        logo={{
          dataUrl: practice.logoDataUrl,
          position: practice.logo.position,
          size: practice.logo.size,
        }}
        name={firm.name}
        tagline={t("Architecture · Engineering · Project Management")}
        borderClass="border-b-2 border-gray-900 pb-4"
        details={
          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">{t("Receipt")}</div>
            <div className="mt-1 font-mono text-xs text-gray-600">{number}</div>
            <div className="text-[11px] text-gray-500">{militaryDate(payment.paidAt)}</div>
          </div>
        }
      />

      {payment.reversedAt ? (
        <div className="mt-6 rounded border-2 border-red-700 px-3 py-2 text-[12px] font-bold tracking-wide text-red-700">
          {payment.reverseReason
            ? fmt(t("REVERSED {date}: {reason}"), {
                date: militaryDate(payment.reversedAt),
                reason: payment.reverseReason,
              })
            : fmt(t("REVERSED {date}"), { date: militaryDate(payment.reversedAt) })}
          <div className="mt-1 text-[10px] font-normal tracking-normal text-gray-600">
            {t("This payment was reversed and does not count towards the invoice.")}
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-between gap-6 text-[11px] leading-relaxed">
        <div>
          <div className="text-gray-400">{t("Received from")}</div>
          <div className="font-medium text-gray-900">{invoice.clientName}</div>
          {invoice.contactName ? <div className="text-gray-700">{invoice.contactName}</div> : null}
          {invoice.billingAddress ? <div className="text-gray-700">{invoice.billingAddress}</div> : null}
        </div>
        <div className="text-right">
          {invoice.projectName ? (
            <>
              <div className="text-gray-400">{t("Project")}</div>
              <div className="text-gray-900">{invoice.projectName}</div>
            </>
          ) : null}
          <div className="mt-1 text-gray-400">{t("For invoice")}</div>
          <div className="font-mono text-gray-900">{invoice.number}</div>
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-[11px]">
        <tbody>
          {facts.map(([label, value, mono]) => (
            <tr key={label} className="border-b border-gray-200">
              <td className="w-48 py-1.5 pr-2 text-gray-500">{label}</td>
              <td className={`py-1.5 text-gray-900 ${mono ? "font-mono" : ""}`}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex items-baseline justify-between border-t-2 border-gray-900 pt-2">
        <span className="text-sm font-semibold text-gray-900">{t("Amount received")}</span>
        <span
          className={`font-mono text-lg font-bold ${payment.reversedAt ? "text-gray-400 line-through" : "text-gray-900"}`}
        >
          {money(payment.amount)}
        </span>
      </div>

      {payment.recordedByName ? (
        <p className="mt-3 text-[10px] text-gray-500">
          {fmt(t("Recorded by {name}"), { name: payment.recordedByName })}
        </p>
      ) : null}

      <div className="mt-8 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
        {firm.name} · {number} · {money(payment.amount)} {invoice.currency}
      </div>
    </PrintSurface>
  );
}
