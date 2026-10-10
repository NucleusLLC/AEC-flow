import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import { notFound } from "next/navigation";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { PrintSurface } from "@/components/print/print-surface";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { getCreditNote } from "@/lib/data/credit-notes";
import { militaryDate } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Credit note")} · ${t("Print")}` };
}

/**
 * The credit note as the client receives it. Same print shell, letterhead,
 * firm identity, A4 sheet and page footer as the invoice print
 * (app/print/finance/invoices/[id]/page.tsx): the two are read side by side.
 *
 * It prints the STORED totals — fixed when the credit note was saved, at the
 * invoice's own tax rate — and names the invoice it credits, because a credit
 * note that does not say what it reduces cannot be booked by the client.
 * A draft prints DRAFT beside its number; a void says so.
 */
export default async function CreditNotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [note, practice, firm] = await Promise.all([
    getCreditNote(id),
    getPracticeSettings(),
    getFirmIdentity(),
  ]);
  if (!note) notFound();
  const t = await getServerT();

  const money = (n: number) =>
    formatCurrency(n, note.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <PrintSurface backHref={`/finance/credit-notes/${note.id}`} backLabel={note.number}>
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
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">
              {note.status === "VOID" ? t("Void credit note") : t("Credit note")}
            </div>
            <div className="mt-1 font-mono text-xs text-gray-600">{note.number}</div>
            <div className="text-[11px] text-gray-500">
              {militaryDate(note.date)}
              {note.status === "DRAFT" ? ` · ${t("DRAFT")}` : ""}
            </div>
          </div>
        }
      />

      <div className="mt-6 flex flex-wrap justify-between gap-6 text-[11px] leading-relaxed">
        <div>
          <div className="uppercase tracking-wide text-gray-400">{t("Credited to")}</div>
          <div className="font-medium text-gray-900">{note.clientName}</div>
          {note.contactName ? <div className="text-gray-700">{note.contactName}</div> : null}
          {note.billingAddress ? <div className="text-gray-700">{note.billingAddress}</div> : null}
        </div>
        <div className="text-right">
          <div className="uppercase tracking-wide text-gray-400">{t("Against invoice")}</div>
          <div className="font-mono text-gray-900">{note.invoiceNumber}</div>
          {note.projectName ? (
            <>
              <div className="mt-1 uppercase tracking-wide text-gray-400">{t("Project")}</div>
              <div className="text-gray-900">{note.projectName}</div>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-6 break-inside-avoid text-[11px]">
        <div className="uppercase tracking-wide text-gray-400">{t("Reason")}</div>
        <p className="whitespace-pre-line text-gray-900">{note.reason}</p>
      </div>

      <table className="mt-6 w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-gray-300 text-left uppercase tracking-wide text-gray-500">
            <th className="py-1 pr-2 font-medium">{t("Description")}</th>
            <th className="py-1 pl-2 text-right font-medium">{t("Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {note.lines.map((l) => (
            <tr key={l.id} className="break-inside-avoid border-b border-gray-200 align-top">
              <td className="py-1.5 pr-2 text-gray-900">
                {l.description}
                {l.taxable ? "" : <span className="text-gray-400"> ({t("no tax")})</span>}
              </td>
              <td className="py-1.5 pl-2 text-right font-mono text-gray-900">{money(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end break-inside-avoid">
        <table className="w-64 text-[11px]">
          <tbody>
            <tr>
              <td className="py-0.5 text-gray-500">{t("Subtotal")}</td>
              <td className="py-0.5 text-right font-mono text-gray-900">{money(note.subtotal)}</td>
            </tr>
            {note.taxPercent > 0 ? (
              <tr>
                <td className="py-0.5 text-gray-500">
                  {note.taxName ?? t("Tax")} {note.taxPercent}%
                  {note.taxMode === "INCLUSIVE" ? ` ${t("(included)")}` : ""}
                </td>
                <td className="py-0.5 text-right font-mono text-gray-900">{money(note.taxTotal)}</td>
              </tr>
            ) : null}
            <tr className="border-t border-gray-900">
              <td className="py-1 font-semibold uppercase text-gray-900">{t("Credit total")}</td>
              <td className="py-1 text-right font-mono text-sm font-bold text-gray-900">{money(note.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-6 text-[10px] leading-relaxed text-gray-700">
        {fmt(t("This credit note reduces the balance of invoice {number} by {amount}."), {
          number: note.invoiceNumber,
          amount: money(note.total),
        })}
      </p>

      {note.status === "VOID" ? (
        <p className="mt-6 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          {note.voidReason
            ? fmt(t("This credit note has been voided: {reason}."), { reason: note.voidReason })
            : t("This credit note has been voided.")}
        </p>
      ) : null}

      <div className="mt-6 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
        {firm.name} · {note.number} · {money(note.total)} {note.currency}
      </div>
    </PrintSurface>
  );
}
