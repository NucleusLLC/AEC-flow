/**
 * ProposalDocument — the branded A4 "Fee Proposal" sheet.
 *
 * One presentational component, no hooks, so it renders identically in:
 *   • the print route  (app/print/proposals/[id])   — what becomes the PDF
 *   • the Preview modal (components/proposals/proposal-preview) — in-app preview
 *
 * Keeping a single source of truth means the on-screen preview is exactly what
 * the client receives. Pass a full ProposalRecord (real saved record, or one
 * assembled live from the editor's form state).
 */

import {
  committedFee,
  optionalFee,
  DISCIPLINE_LABEL,
  type ProposalRecord,
} from "@/lib/data/proposals.types";
import { formatCurrency, formatDate, SYSTEM_LOCALE } from "@/lib/format";
import { documentFooterLine, firmLocation, firmName } from "@/lib/firm-identity";
import { DocumentLetterhead, type LetterheadLogo } from "@/components/print/document-letterhead";
import { fmt } from "@/lib/i18n/format";

const identity = (text: string) => text;

export function ProposalDocument({
  proposal,
  logo,
  companyName,
  companyLocation,
  sheet = true,
  t = identity,
  locale = SYSTEM_LOCALE,
}: {
  proposal: ProposalRecord;
  logo?: LetterheadLogo;
  /** Configured practice name. Server print routes pass it; previews fall back to
   *  the client-seeded firm identity (see lib/firm-identity.ts). */
  companyName?: string;
  /** Configured practice location for the footer; omitted entirely when unset. */
  companyLocation?: string;
  /**
   * Whether to draw the paper this document sits on.
   *
   * The print route passes false, because `PrintSurface` supplies a sheet sized
   * from the page tokens and nesting an 820px column inside a 210mm one would
   * make the measuring pass paginate against a width the printer never uses. The
   * Preview modal leaves it true: it has no surface around it, and the sheet IS
   * what makes the modal read as a document.
   */
  sheet?: boolean;
  /** Translator for the document's fixed labels. The print route passes the server
   *  translator, the Preview modal the client one; defaults to English. */
  t?: (text: string) => string;
  /** Date locale for the labels. Server print routes pass `getServerLocale()`. */
  locale?: string;
}) {
  const firm = firmName(companyName);
  const location = firmLocation(companyLocation);
  const committed = committedFee(proposal);
  const optional = optionalFee(proposal);
  const lineItems = [...proposal.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);

  const body = (
    <>
      {/* Letterhead */}
      <DocumentLetterhead
        logo={logo}
        name={companyName}
        details={
          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">{t("Fee Proposal")}</div>
            <div className="mt-1 font-mono text-xs text-gray-600">{proposal.refNumber}</div>
            {proposal.revision > 1 ? (
              <div className="text-xs text-gray-500">{fmt(t("Revision {n}"), { n: proposal.revision })}</div>
            ) : null}
          </div>
        }
      />

      {/* Parties */}
      <div className="mt-6 grid grid-cols-2 gap-8">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t("Prepared for")}</div>
          <div className="mt-1 text-base font-semibold text-gray-900">{proposal.clientName}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t("Prepared by")}</div>
          <div className="mt-1 font-semibold text-gray-900">{firm}</div>
          <div className="text-gray-600">{proposal.owner}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 rounded-md bg-gray-50 px-4 py-3 text-xs print:bg-gray-50">
        <div>
          <div className="text-gray-400">{t("Date issued")}</div>
          <div className="font-medium text-gray-900">{formatDate(proposal.sentAt ?? proposal.createdAt, locale)}</div>
        </div>
        <div>
          <div className="text-gray-400">{t("Valid until")}</div>
          <div className="font-medium text-gray-900">{formatDate(proposal.validUntil, locale)}</div>
        </div>
        <div>
          <div className="text-gray-400">{t("Estimated duration")}</div>
          <div className="font-medium text-gray-900">
            {proposal.estimatedDuration ? fmt(t("{n} weeks"), { n: proposal.estimatedDuration }) : "—"}
          </div>
        </div>
      </div>

      {/* Title + scope */}
      <h1 className="mt-7 text-xl font-bold text-gray-900">{proposal.title || t("Untitled proposal")}</h1>
      {proposal.scopeSummary ? <p className="mt-2 text-gray-700">{proposal.scopeSummary}</p> : null}

      {/* Fee breakdown */}
      <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t("Fee Breakdown")}</h2>
      <table className="mt-2 w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
            <th className="py-2 pr-3 font-semibold">{t("Service")}</th>
            <th className="py-2 pr-3 font-semibold">{t("Discipline")}</th>
            <th className="py-2 text-right font-semibold">{t("Fee")}</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.length ? (
            lineItems.map((li) => (
              <tr key={li.id} className="border-b border-gray-100 align-top">
                <td className="py-2 pr-3 text-gray-900">
                  {li.description || "—"}
                  {li.isOptional ? (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-gray-400">{t("(optional)")}</span>
                  ) : null}
                </td>
                <td className="py-2 pr-3 text-gray-600">
                  {li.discipline ? t(DISCIPLINE_LABEL[li.discipline]) : "—"}
                </td>
                <td className="py-2 text-right tabular-nums text-gray-900">
                  {formatCurrency(li.amount, proposal.currency)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="py-3 text-gray-400" colSpan={3}>{t("No services listed yet.")}</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-900">
            <td className="py-2 pr-3 font-semibold text-gray-900" colSpan={2}>
              {t("Total fee (excl. optional add-ons)")}
            </td>
            <td className="py-2 text-right font-bold tabular-nums text-gray-900">
              {formatCurrency(committed, proposal.currency)}
            </td>
          </tr>
          {optional > 0 ? (
            <tr>
              <td className="py-1 pr-3 text-xs text-gray-500" colSpan={2}>{t("Optional add-ons available")}</td>
              <td className="py-1 text-right text-xs tabular-nums text-gray-600">
                {formatCurrency(optional, proposal.currency)}
              </td>
            </tr>
          ) : null}
        </tfoot>
      </table>

      {/* Payment schedule */}
      {proposal.milestones.length ? (
        <>
          <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t("Payment Schedule")}</h2>
          <table className="mt-2 w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3 font-semibold">{t("Milestone")}</th>
                <th className="py-2 pr-3 font-semibold">{t("When")}</th>
                <th className="py-2 pr-3 text-right font-semibold">{t("Share")}</th>
                <th className="py-2 text-right font-semibold">{t("Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {proposal.milestones.map((m) => (
                <tr key={m.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3 text-gray-900">{m.name}</td>
                  <td className="py-2 pr-3 text-gray-600">
                    {m.dueWeek === null ? "—" : m.dueWeek === 0 ? t("On appointment") : fmt(t("Week {n}"), { n: m.dueWeek })}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-gray-600">{m.percentage}%</td>
                  <td className="py-2 text-right tabular-nums text-gray-900">
                    {formatCurrency(Math.round((committed * m.percentage) / 100), proposal.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {/* Terms blocks */}
      <div className="mt-7 space-y-4">
        {proposal.assumptions ? (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t("Assumptions")}</h3>
            <p className="mt-1 text-gray-700">{proposal.assumptions}</p>
          </section>
        ) : null}
        {proposal.exclusions ? (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t("Exclusions")}</h3>
            <p className="mt-1 text-gray-700">{proposal.exclusions}</p>
          </section>
        ) : null}
        {proposal.terms ? (
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{t("Payment Terms")}</h3>
            <p className="mt-1 text-gray-700">{proposal.terms}</p>
          </section>
        ) : null}
      </div>

      {/* Acceptance / signatures */}
      <div className="mt-10 break-inside-avoid border-t border-gray-300 pt-6">
        <p className="text-xs text-gray-500">
          {fmt(
            t("This proposal is valid until {date}. To proceed, please countersign below and return a copy to {firm}."),
            { date: formatDate(proposal.validUntil, locale), firm },
          )}
        </p>
        <div className="mt-8 grid grid-cols-2 gap-10">
          <div>
            <div className="h-px w-full bg-gray-400" />
            <div className="mt-1 text-xs text-gray-600">{fmt(t("For and on behalf of {party}"), { party: firm })}</div>
            <div className="text-[11px] text-gray-400">{proposal.owner} · {t("Date")}</div>
          </div>
          <div>
            <div className="h-px w-full bg-gray-400" />
            <div className="mt-1 text-xs text-gray-600">{fmt(t("For and on behalf of {party}"), { party: proposal.clientName })}</div>
            <div className="text-[11px] text-gray-400">{t("Name · Position · Date")}</div>
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
        {documentFooterLine(
          firm,
          location,
          proposal.refNumber,
          proposal.revision > 1 ? fmt(t("Rev {n}"), { n: proposal.revision }) : "",
        )}
      </div>
    </>
  );

  if (!sheet) return body;
  return (
    <div className="mx-auto w-[820px] max-w-full bg-white p-12 text-[13px] leading-relaxed text-gray-900 shadow-sm print:max-w-none print:p-0 print:shadow-none">
      {body}
    </div>
  );
}
