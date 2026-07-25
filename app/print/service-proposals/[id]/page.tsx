import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServiceProposal } from "@/lib/data/service-proposals";
import { computeProposal } from "@/lib/proposals/engine/engine";
import type { ProposalCalcInput } from "@/lib/proposals/engine/types";
import { STATUS_LABEL } from "@/lib/proposals/engine/status";
import { formatCurrency } from "@/lib/format";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";

export const metadata: Metadata = { title: "Service Proposal · Print" };

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

  const calc = computeProposal(p.input as ProposalCalcInput);
  const money = (n: number) => formatCurrency(n, p.currency, { maximumFractionDigits: 2 });

  const baseComponents = calc.components.filter((c) => c.category === "BASE");
  const selectedOptional = calc.components.filter((c) => c.category === "OPTIONAL" && c.countedInTotal);
  const otherOptional = calc.components.filter((c) => c.category === "OPTIONAL" && !c.countedInTotal);

  return (
    <CaPrintShell
      backHref={`/design/service-proposals/${p.id}`}
      docTitle="Service Proposal"
      refNumber={`${p.number}${p.revision > 1 ? ` r${p.revision}` : ""}`}
      statusLabel={STATUS_LABEL[p.status]}
      title={p.title}
      meta={[
        { label: "Client", value: p.clientName ?? "—" },
        { label: "Project", value: p.projectName ?? "—" },
        { label: "Issued", value: p.issuedAt ? p.issuedAt.slice(0, 10) : "—" },
        { label: "Valid until", value: p.validUntil ?? "—" },
      ]}
      signatures={[
        { role: "Prepared by", name: p.createdByName ?? "" },
        { role: "For the client", name: p.contactName ?? "" },
        { role: "Date", name: "" },
      ]}
    >
      {p.input.scopeSummary || (p.input.scopeItems && p.input.scopeItems.length > 0) ? (
        <PrintSection title="Scope of services">
          {p.input.scopeSummary ? (
            <p className="whitespace-pre-wrap text-[11px] text-gray-700">{p.input.scopeSummary}</p>
          ) : null}
          {p.input.scopeItems && p.input.scopeItems.length > 0 ? (
            <ul className="mt-2 space-y-1 text-[11px]">
              {p.input.scopeItems.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className={s.included ? "text-gray-900" : "text-gray-400"}>{s.included ? "✓" : "✕"}</span>
                  <span className={s.included ? "text-gray-900" : "text-gray-500 line-through"}>
                    <strong>{s.title}</strong>
                    {s.description ? <span className="text-gray-600"> — {s.description}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </PrintSection>
      ) : null}

      <PrintSection title="Professional fees">
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-500">
              <th className="py-1.5 pr-2 font-medium">Service</th>
              <th className="py-1.5 pl-2 text-right font-medium">Fee</th>
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
                <td className="py-1.5 pr-2 text-gray-900">{c.label} <span className="text-gray-400">(optional, included)</span></td>
                <td className="py-1.5 pl-2 text-right tabular-nums text-gray-900">{money(c.effectiveAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-300">
              <td className="py-1.5 pr-2 font-semibold text-gray-900">Subtotal</td>
              <td className="py-1.5 pl-2 text-right font-semibold tabular-nums text-gray-900">{money(calc.totals.subtotal)}</td>
            </tr>
            {calc.totals.discountTotal > 0 ? (
              <tr><td className="py-1 pr-2 text-gray-600">Discount</td><td className="py-1 pl-2 text-right tabular-nums text-gray-700">− {money(calc.totals.discountTotal)}</td></tr>
            ) : null}
            {calc.totals.taxTotal > 0 ? (
              <tr><td className="py-1 pr-2 text-gray-600">Tax</td><td className="py-1 pl-2 text-right tabular-nums text-gray-700">{money(calc.totals.taxTotal)}</td></tr>
            ) : null}
            <tr className="border-t border-gray-300">
              <td className="py-1.5 pr-2 font-bold text-gray-900">Grand total</td>
              <td className="py-1.5 pl-2 text-right font-bold tabular-nums text-gray-900">{money(calc.totals.grandTotal)}</td>
            </tr>
          </tfoot>
        </table>

        {p.showFeeDerivation && calc.basis ? (
          <p className="mt-2 text-[10px] text-gray-500">
            Percentage fees are based on the {calc.basis.label.toLowerCase()} of {money(calc.basis.amount)}.
          </p>
        ) : null}
      </PrintSection>

      {calc.phases.length > 0 ? (
        <PrintSection title="Design phases">
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
        <PrintSection title="Payment schedule">
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              {calc.paymentSchedule.map((m) => (
                <tr key={m.id} className="border-b border-gray-200">
                  <td className="py-1.5 pr-2 text-gray-900">{m.name}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">{m.percent}%</td>
                  <td className="py-1.5 pl-2 text-right tabular-nums text-gray-900">{money(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintSection>
      ) : null}

      {otherOptional.length > 0 ? (
        <PrintSection title="Optional services (not included in the total)">
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
        <PrintSection title="Assumptions">
          <p className="whitespace-pre-wrap text-[11px] text-gray-700">{p.input.assumptions}</p>
        </PrintSection>
      ) : null}

      {p.input.exclusions ? (
        <PrintSection title="Exclusions">
          <p className="whitespace-pre-wrap text-[11px] text-gray-700">{p.input.exclusions}</p>
        </PrintSection>
      ) : null}

      {p.input.terms ? (
        <PrintSection title="Terms & conditions">
          <p className="whitespace-pre-wrap text-[11px] text-gray-700">{p.input.terms}</p>
        </PrintSection>
      ) : null}
    </CaPrintShell>
  );
}
