import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServiceProposal, getServiceProposalIdentification } from "@/lib/data/service-proposals";
import { computeProposal } from "@/lib/proposals/engine/engine";
import type { ProposalCalcInput } from "@/lib/proposals/engine/types";
import { STATUS_LABEL } from "@/lib/proposals/engine/status";
import { formatCurrency } from "@/lib/format";
import { bboPerMilestone, resolveBbo } from "@/lib/proposals/bbo";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";
import { Emphasised, RichText } from "@/components/print/rich-text";
import { stripMarkers } from "@/lib/documents/emphasis";
import { ProposalIdentificationPrint } from "@/components/service-proposals/proposal-identification";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Service Proposal")} · ${t("Print")}` };
}

/**
 * Client-facing proposal document.
 *
 * CONFIDENTIALITY: this renders ONLY client-safe fields. Internal notes, manual-override
 * reasons, internal cost budgets and margins are deliberately never read here — the document
 * is what the client receives. The fee derivation is shown only when the author opted in
 * (`showFeeDerivation`). See docs/proposal-module/03-CRITICAL-REVIEW.md §C4.
 */
export default async function ServiceProposalPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getServiceProposal(id);
  if (!p) notFound();
  const t = await getServerT();

  const identification = await getServiceProposalIdentification(p);
  const calc = computeProposal(p.input as ProposalCalcInput);
  const money = (n: number) => formatCurrency(n, p.currency, { maximumFractionDigits: 2 });

  // The tax contained in the price, named and stated. The client sees that the
  // price is not about to grow; the bookkeeping sees what is payable, and the
  // payment schedule below says which month each part of it falls in.
  const bbo = resolveBbo({
    currency: p.currency,
    grandTotal: calc.totals.grandTotal,
    taxes: p.input.taxes,
    taxTotal: calc.totals.taxTotal,
    taxableSubtotal: calc.totals.taxableSubtotal,
  });
  const milestoneBbo = bboPerMilestone(calc.paymentSchedule, bbo.amount, p.currency);
  // Same wording as bboNote() in lib/proposals/bbo, translated for the document.
  const bboText = fmt(t(bbo.included ? "{name} is included in the price." : "{name} is added to the price."), { name: bbo.name });

  const baseComponents = calc.components.filter((c) => c.category === "BASE");
  const selectedOptional = calc.components.filter((c) => c.category === "OPTIONAL" && c.countedInTotal);
  const otherOptional = calc.components.filter((c) => c.category === "OPTIONAL" && !c.countedInTotal);

  return (
    <CaPrintShell
      backHref={`/design/service-proposals/${p.id}`}
      docTitle={t("Service Proposal")}
      refNumber={`${p.number}${p.revision > 1 ? ` r${p.revision}` : ""}`}
      statusLabel={t(STATUS_LABEL[p.status])}
      versionLabel={p.versionLabel}
      title={p.title}
      meta={[
        { label: t("Client"), value: identification.clientDisplayName ?? "—" },
        { label: t("Project"), value: identification.projectDisplayName ?? "—" },
        { label: t("Issued"), value: p.issuedAt ? p.issuedAt.slice(0, 10) : "—" },
        { label: t("Valid until"), value: p.validUntil ?? "—" },
      ]}
      signatures={[
        { role: t("Prepared by"), name: p.createdByName ?? "" },
        { role: t("For the client"), name: p.contactName ?? "" },
        { role: t("Date"), name: "" },
      ]}
    >
      {/* Identification block — the default opening section of the document. Absent entirely
       * when the proposal has no linked client or project. */}
      {identification.hasAny ? (
        <PrintSection title={t("Project & client")}>
          <ProposalIdentificationPrint identification={identification} t={t} />
        </PrintSection>
      ) : null}

      {p.input.scopeSummary || (p.input.scopeItems && p.input.scopeItems.length > 0) ? (
        <PrintSection title={t("Scope of services")}>
          {p.input.scopeSummary ? (
            <RichText text={p.input.scopeSummary} />
          ) : null}
          {p.input.scopeItems && p.input.scopeItems.length > 0 ? (
            <ul className="mt-2 space-y-1 text-[11px]">
              {p.input.scopeItems.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className={s.included ? "text-gray-900" : "text-gray-400"}>{s.included ? "✓" : "✕"}</span>
                  <span className={s.included ? "text-gray-900" : "text-gray-500 line-through"}>
                    <strong>{stripMarkers(s.title)}</strong>
                    {s.description ? (
                      <span className="text-gray-600">
                        {" — "}
                        <Emphasised text={s.description} />
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </PrintSection>
      ) : null}

      <PrintSection title={t("Professional fees")}>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-1.5 pr-2 font-medium">{t("Service")}</th>
              <th className="py-1.5 pl-2 text-right font-medium">{t("Fee")}</th>
            </tr>
          </thead>
          <tbody>
            {baseComponents.map((c) => (
              <tr key={c.id} className="border-b border-gray-200">
                <td className="py-1.5 pr-2 text-gray-900">{c.label}</td>
                <td className="py-1.5 pl-2 text-right tabular-nums text-gray-900">{money(c.effectiveAmount)}</td>
              </tr>
            ))}
            {selectedOptional.map((c) => (
              <tr key={c.id} className="border-b border-gray-200">
                <td className="py-1.5 pr-2 text-gray-900">{c.label} <span className="text-gray-400">{t("(optional, included)")}</span></td>
                <td className="py-1.5 pl-2 text-right tabular-nums text-gray-900">{money(c.effectiveAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-300">
              <td className="py-1.5 pr-2 font-semibold text-gray-900">{t("Subtotal")}</td>
              <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-gray-900">{money(calc.totals.subtotal)}</td>
            </tr>
            {calc.totals.discountTotal > 0 ? (
              <tr><td className="py-1 pr-2 text-gray-600">{t("Discount")}</td><td className="py-1 pl-2 text-right tabular-nums text-gray-700">− {money(calc.totals.discountTotal)}</td></tr>
            ) : null}
            {bbo.amount > 0 ? (
              <tr>
                <td className="py-1 pr-2 text-gray-600">
                  {bbo.name} {bbo.percent}%
                </td>
                <td className="py-1 pl-2 text-right tabular-nums text-gray-700">{money(bbo.amount)}</td>
              </tr>
            ) : null}
            <tr className="border-t border-gray-300">
              <td className="py-1.5 pr-2 font-bold text-gray-900">{t("Grand total")}</td>
              <td className="py-1.5 pl-2 text-right font-bold tabular-nums text-gray-900">{money(calc.totals.grandTotal)}</td>
            </tr>
            {bbo.amount > 0 ? (
              <tr>
                <td className="pt-1 text-[10px] text-gray-500" colSpan={2}>
                  ({bboText})
                </td>
              </tr>
            ) : null}
          </tfoot>
        </table>

        {p.showFeeDerivation && calc.basis ? (
          <p className="mt-2 text-[10px] text-gray-500">
            {fmt(t("Percentage fees are based on the {basis} of {amount}."), {
              basis: t(calc.basis.label).toLowerCase(),
              amount: money(calc.basis.amount),
            })}
          </p>
        ) : null}
      </PrintSection>

      {calc.phases.length > 0 ? (
        <PrintSection title={t("Design phases")}>
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              {calc.phases.map((ph) => (
                <tr key={ph.id} className="border-b border-gray-200">
                  <td className="py-1.5 pr-2 text-gray-900">{ph.name}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">{ph.percent}%</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums text-gray-900">{money(ph.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSection>
      ) : null}

      {calc.paymentSchedule.length > 0 ? (
        <PrintSection title={t("Payment schedule")}>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-gray-300 text-left text-gray-500">
                <th className="py-1.5 pr-2 font-medium">{t("Instalment")}</th>
                <th className="py-1.5 px-2 text-right font-medium">{t("Share")}</th>
                <th className="py-1.5 px-2 text-right font-medium">{t("Amount")}</th>
                <th className="py-1.5 pl-2 text-right font-medium">
                  {fmt(t("{name} incl. ({pct}%)"), { name: bbo.name, pct: bbo.percent })}
                </th>
              </tr>
            </thead>
            <tbody>
              {calc.paymentSchedule.map((m) => (
                <tr key={m.id} className="border-b border-gray-200">
                  <td className="py-1.5 pr-2 text-gray-900">{m.name}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">{m.percent}%</td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-gray-900">{money(m.amount)}</td>
                  {/* Allocated from the proposal's own BBO figure, so this column
                    * adds up to the one in the fee table rather than to a
                    * per-row percentage that rounds differently. */}
                  <td className="py-1.5 pl-2 text-right tabular-nums text-gray-600">
                    {money(milestoneBbo[m.id] ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-300">
                <td className="py-1.5 pr-2 font-semibold text-gray-900" colSpan={2}>{t("Total")}</td>
                <td className="py-1.5 px-2 text-right font-semibold tabular-nums text-gray-900">
                  {money(calc.totals.grandTotal)}
                </td>
                <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-gray-900">
                  {money(bbo.amount)}
                </td>
              </tr>
              <tr>
                <td className="pt-1 text-[10px] text-gray-500" colSpan={4}>
                  ({bboText}{" "}{t("Each instalment’s share is payable in the month it is invoiced.")})
                </td>
              </tr>
            </tfoot>
          </table>
        </PrintSection>
      ) : null}

      {otherOptional.length > 0 ? (
        <PrintSection title={t("Optional services (not included in the total)")}>
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              {otherOptional.map((c) => (
                <tr key={c.id} className="border-b border-gray-200">
                  <td className="py-1.5 pr-2 text-gray-900">{c.label}</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums text-gray-700">{money(c.effectiveAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSection>
      ) : null}

      {p.input.assumptions ? (
        <PrintSection title={t("Assumptions")}>
          <RichText text={p.input.assumptions} />
        </PrintSection>
      ) : null}

      {p.input.exclusions ? (
        <PrintSection title={t("Exclusions")}>
          <RichText text={p.input.exclusions} />
        </PrintSection>
      ) : null}

      {p.input.terms ? (
        <PrintSection title={t("Terms & conditions")}>
          <RichText text={p.input.terms} />
        </PrintSection>
      ) : null}
    </CaPrintShell>
  );
}
