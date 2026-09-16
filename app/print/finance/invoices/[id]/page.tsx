import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { PrintSurface } from "@/components/print/print-surface";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { getInvoice } from "@/lib/data/invoices";
import { settlement } from "@/lib/finance/calc";
import { militaryDate } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/finance/types";

export const metadata: Metadata = { title: "Invoice · Print" };

/**
 * The invoice as the client receives it.
 *
 * It prints the STORED totals, not a fresh calculation: the figures were fixed
 * when the invoice was raised, and a tax rate or a proposal that has moved on
 * since must not change what a client was asked to pay.
 *
 * A draft prints DRAFT beside its number. Payments already received are printed
 * too, with the balance — a client who has paid half should not receive a demand
 * for the whole.
 */
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [invoice, practice, firm] = await Promise.all([
    getInvoice(id),
    getPracticeSettings(),
    getFirmIdentity(),
  ]);
  if (!invoice) notFound();

  const money = (n: number) =>
    formatCurrency(n, invoice.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const { paid, outstanding } = settlement(invoice.total, invoice.payments, invoice.currency);

  return (
    <PrintSurface backHref={`/finance/invoices/${invoice.id}`} backLabel={invoice.number}>
      <DocumentLetterhead
        logo={{
          dataUrl: practice.logoDataUrl,
          position: practice.logo.position,
          size: practice.logo.size,
        }}
        name={firm.name}
        tagline="Architecture · Engineering · Project Management"
        borderClass="border-b-2 border-gray-900 pb-4"
        details={
          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">
              {invoice.status === "VOID" ? "Void invoice" : "Invoice"}
            </div>
            <div className="mt-1 font-mono text-xs text-gray-600">{invoice.number}</div>
            <div className="text-[11px] text-gray-500">
              {militaryDate(invoice.issueDate)}
              {invoice.status === "DRAFT" ? " · DRAFT" : ""}
            </div>
          </div>
        }
      />

      <div className="mt-6 flex flex-wrap justify-between gap-6 text-[11px] leading-relaxed">
        <div>
          <div className="text-gray-400">Billed to</div>
          <div className="font-medium text-gray-900">{invoice.clientName}</div>
          {invoice.contactName ? <div className="text-gray-700">{invoice.contactName}</div> : null}
          {invoice.billingAddress ? (
            <div className="text-gray-700">{invoice.billingAddress}</div>
          ) : null}
        </div>
        <div className="text-right">
          {invoice.projectName ? (
            <>
              <div className="text-gray-400">Project</div>
              <div className="text-gray-900">{invoice.projectName}</div>
            </>
          ) : null}
          {invoice.proposalNumber ? (
            <>
              <div className="mt-1 text-gray-400">Proposal</div>
              <div className="font-mono text-gray-900">{invoice.proposalNumber}</div>
            </>
          ) : null}
          <div className="mt-1 text-gray-400">Due</div>
          <div className="text-gray-900">
            {militaryDate(invoice.dueDate)}
            {invoice.termsDays !== null ? ` (${invoice.termsDays} days)` : ""}
          </div>
        </div>
      </div>

      {invoice.title ? (
        <h1 className="mt-6 text-lg font-bold text-gray-900">{invoice.title}</h1>
      ) : null}
      {invoice.intro ? (
        <p className="mt-2 whitespace-pre-line text-[11px] text-gray-800">{invoice.intro}</p>
      ) : null}

      <table className="mt-6 w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-gray-300 text-left text-gray-500">
            <th className="py-1 pr-2 font-medium">Description</th>
            <th className="py-1 px-2 text-right font-medium">Qty</th>
            <th className="py-1 px-2 text-right font-medium">Rate</th>
            <th className="py-1 pl-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((l) => (
            <tr key={l.id} className="break-inside-avoid border-b border-gray-200 align-top">
              <td className="py-1.5 pr-2 text-gray-900">
                {l.description}
                {l.taxable ? "" : <span className="text-gray-400"> (no tax)</span>}
              </td>
              <td className="py-1.5 px-2 text-right text-gray-700">{l.quantity ?? ""}</td>
              <td className="py-1.5 px-2 text-right font-mono text-gray-700">
                {l.unitRate === null ? "" : money(l.unitRate)}
              </td>
              <td className="py-1.5 pl-2 text-right font-mono text-gray-900">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <table className="w-64 text-[11px]">
          <tbody>
            <tr>
              <td className="py-0.5 text-gray-500">Subtotal</td>
              <td className="py-0.5 text-right font-mono text-gray-900">{money(invoice.subtotal)}</td>
            </tr>
            {invoice.taxPercent > 0 ? (
              <tr>
                <td className="py-0.5 text-gray-500">
                  {invoice.taxName ?? "Tax"} {invoice.taxPercent}%
                  {invoice.taxMode === "INCLUSIVE" ? " (included)" : ""}
                </td>
                <td className="py-0.5 text-right font-mono text-gray-900">{money(invoice.taxTotal)}</td>
              </tr>
            ) : null}
            <tr className="border-t border-gray-900">
              <td className="py-1 font-semibold text-gray-900">Total</td>
              <td className="py-1 text-right font-mono text-sm font-bold text-gray-900">
                {money(invoice.total)}
              </td>
            </tr>
            {paid > 0 ? (
              <>
                <tr>
                  <td className="py-0.5 text-gray-500">Received</td>
                  <td className="py-0.5 text-right font-mono text-gray-900">−{money(paid)}</td>
                </tr>
                <tr className="border-t border-gray-300">
                  <td className="py-1 font-semibold text-gray-900">Balance due</td>
                  <td className="py-1 text-right font-mono text-sm font-bold text-gray-900">
                    {money(outstanding)}
                  </td>
                </tr>
              </>
            ) : null}
          </tbody>
        </table>
      </div>

      {invoice.payments.length > 0 ? (
        <div className="mt-6 break-inside-avoid">
          <h2 className="border-b border-gray-300 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Payments received
          </h2>
          <table className="mt-2 w-full border-collapse text-[10px]">
            <tbody>
              {invoice.payments.map((p) => (
                <tr key={p.id} className="border-b border-gray-200">
                  <td className="py-1 pr-2 font-mono text-gray-700">{militaryDate(p.paidAt)}</td>
                  <td className="py-1 px-2 text-gray-700">{PAYMENT_METHOD_LABEL[p.method]}</td>
                  <td className="py-1 px-2 font-mono text-gray-500">{p.reference ?? ""}</td>
                  <td className="py-1 pl-2 text-right font-mono text-gray-900">{money(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {invoice.footer ? (
        <p className="mt-8 whitespace-pre-line text-[10px] leading-relaxed text-gray-700">
          {invoice.footer}
        </p>
      ) : null}

      {invoice.status === "VOID" ? (
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          This invoice has been voided{invoice.voidReason ? `: ${invoice.voidReason}` : ""}.
        </p>
      ) : null}

      <div className="mt-6 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
        {firm.name} · {invoice.number} · {money(invoice.total)} {invoice.currency}
      </div>
    </PrintSurface>
  );
}
