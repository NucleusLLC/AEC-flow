/**
 * EstimateDocument — the branded A4 "Cost Estimate / Bill of Quantities" sheet.
 *
 * One presentational component, no hooks. Renders the same in the print route
 * (app/print/estimates/[id]) — what becomes the PDF — as it would in any in-app
 * preview. All money comes from `lib/estimates/calc`, the single source of truth
 * shared with the live Estimate editor, so the PDF equals the screen.
 *
 * Client-facing layout: each section lists its line items with a blended unit
 * rate and amount (labour + material + equipment + subcontract), a section
 * subtotal, then the markup roll-up (General Conditions optional, Profit, BBO).
 */

import type { CostEstimate } from "@/lib/data/estimates";
import type { GeneralConditionItem } from "@/lib/data/general-conditions";
import { calcItem, categoryTotals, estimateTotals } from "@/lib/estimates/calc";
import { DocumentLetterhead, type LetterheadLogo } from "@/components/print/document-letterhead";
import { documentFooterLine, firmName } from "@/lib/firm-identity";

const nf0 = (n: number) => Math.round(n).toLocaleString("en-US");
const nf2 = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function EstimateDocument({
  est,
  generalConditions,
  usdRate,
  logo,
  companyName,
}: {
  est: CostEstimate;
  /** When provided, enabled items are added as a "General Conditions" line before markup. */
  generalConditions?: GeneralConditionItem[];
  /** When provided (>0), show a USD secondary unit: 1 {currency} = usdRate USD. */
  usdRate?: number;
  logo?: LetterheadLogo;
  /** Configured practice name. Server print routes pass it; previews fall back to
   *  the client-seeded firm identity (see lib/firm-identity.ts). */
  companyName?: string;
}) {
  const firm = firmName(companyName);
  const rate = est.avgLaborRate;
  const t = estimateTotals(est, generalConditions);
  const money = (n: number) => `${est.currency} ${nf0(n)}`;
  const area = est.gfa ?? 0; // built-up area drives the per-m² rates
  const enabledGc = (generalConditions ?? []).filter((g) => g.enabled);

  return (
    <div className="mx-auto w-[210mm] max-w-full bg-white p-[16mm] text-[12.5px] leading-relaxed text-gray-900 shadow-sm print:w-auto print:max-w-none print:p-0 print:shadow-none">
      {/* Letterhead */}
      <DocumentLetterhead
        logo={logo}
        name={companyName}
        details={
          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">Cost Estimate</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-400">Bill of Quantities</div>
            <div className="mt-1 font-mono text-xs text-gray-600">{est.id}</div>
            <div className="text-xs text-gray-500">{est.version}</div>
          </div>
        }
      />

      {/* Project meta */}
      <div className="mt-6">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Project</div>
        <div className="mt-1 text-base font-semibold text-gray-900">{est.projectName}</div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-4 rounded-md bg-gray-50 px-4 py-3 text-xs print:bg-gray-50">
        <div>
          <div className="text-gray-400">Project no.</div>
          <div className="font-medium text-gray-900">{est.projectId ?? "—"}</div>
        </div>
        <div>
          <div className="text-gray-400">Client</div>
          <div className="font-medium text-gray-900">{est.client ?? "—"}</div>
        </div>
        <div>
          <div className="text-gray-400">Location</div>
          <div className="font-medium text-gray-900">{est.location}</div>
        </div>
        <div>
          <div className="text-gray-400">Date</div>
          <div className="font-medium text-gray-900">{est.date}</div>
        </div>
      </div>

      {/* Bill of quantities — one block per section */}
      <h2 className="mt-7 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Bill of Quantities</h2>
      <table className="mt-2 w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y border-gray-300 text-left text-[10px] uppercase tracking-wide text-gray-500">
            <th className="w-16 py-2 pr-2 font-semibold">Code</th>
            <th className="py-2 pr-3 font-semibold">Description</th>
            <th className="w-20 py-2 pr-3 text-right font-semibold">Qty</th>
            <th className="w-14 py-2 pr-3 font-semibold">Unit</th>
            <th className="w-28 py-2 pr-3 text-right font-semibold">Rate</th>
            <th className="w-32 py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        {est.categories.map((cat) => {
          const ct = categoryTotals(cat, rate);
          return (
            <tbody key={cat.id} className="break-inside-avoid">
                <tr className="bg-gray-100/80 print:bg-gray-100">
                  <td className="py-1.5 pr-2 font-mono text-[10px] text-gray-500">{cat.code ?? ""}</td>
                  <td className="py-1.5 pr-3 font-semibold text-gray-900" colSpan={5}>
                    {cat.name}
                  </td>
                </tr>
                {cat.items.map((it) => {
                  const ic = calcItem(it, rate);
                  const unitRate = it.qty > 0 ? ic.total / it.qty : 0;
                  return (
                    <tr key={it.id} className="border-b border-gray-100 align-top">
                      <td className="py-1.5 pr-2 font-mono text-[10px] text-gray-400">{it.code ?? ""}</td>
                      <td className="py-1.5 pr-3 text-gray-800">{it.task || "—"}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-gray-700">{nf2(it.qty)}</td>
                      <td className="py-1.5 pr-3 text-gray-500">{it.unit}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-gray-700">{money(unitRate)}</td>
                      <td className="py-1.5 text-right tabular-nums text-gray-900">{money(ic.total)}</td>
                    </tr>
                  );
                })}
                <tr className="border-b border-gray-300">
                  <td />
                  <td className="py-1.5 pr-3 text-[11px] font-semibold uppercase tracking-wide text-gray-500" colSpan={4}>
                    {cat.name} subtotal
                  </td>
                  <td className="py-1.5 text-right font-semibold tabular-nums text-gray-900">{money(ct.total)}</td>
                </tr>
            </tbody>
          );
        })}
      </table>

      {/* Cost composition + markup roll-up */}
      <div className="mt-7 grid grid-cols-2 gap-8 break-inside-avoid">
        {/* Direct-cost composition */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Direct Cost Composition</h3>
          <table className="mt-2 w-full border-collapse text-[12px]">
            <tbody>
              {[
                { label: "Labour", val: t.grand.labor },
                { label: "Material", val: t.grand.mat },
                { label: "Equipment", val: t.grand.equip },
                { label: "Subcontractor", val: t.grand.sub },
              ].map((r) => (
                <tr key={r.label} className="border-b border-gray-100">
                  <td className="py-1.5 text-gray-600">{r.label}</td>
                  <td className="py-1.5 text-right tabular-nums text-gray-900">{money(r.val)}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-300">
                <td className="py-1.5 font-semibold text-gray-900">Direct cost</td>
                <td className="py-1.5 text-right font-semibold tabular-nums text-gray-900">{money(t.direct)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary / grand total */}
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Summary</h3>
          <table className="mt-2 w-full border-collapse text-[12px]">
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-gray-600">Direct cost</td>
                <td className="py-1.5 text-right tabular-nums text-gray-900">{money(t.direct)}</td>
              </tr>
              {generalConditions ? (
                <tr className="border-b border-gray-100">
                  <td className="py-1.5 text-gray-600">
                    General Conditions / Overhead
                    <span className="ml-1 text-[10px] text-gray-400">({enabledGc.length} items)</span>
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-gray-900">{money(t.gcAmount)}</td>
                </tr>
              ) : null}
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-gray-600">Profit &amp; Risk ({est.profitPct}%)</td>
                <td className="py-1.5 text-right tabular-nums text-gray-900">{money(t.profit)}</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-1.5 text-gray-600">BBO ({est.bboPct}%)</td>
                <td className="py-1.5 text-right tabular-nums text-gray-900">{money(t.bbo)}</td>
              </tr>
              <tr className="border-t-2 border-gray-900">
                <td className="py-2 text-sm font-bold text-gray-900">Grand total</td>
                <td className="py-2 text-right text-sm font-bold tabular-nums text-gray-900">{money(t.grandTotal)}</td>
              </tr>
              {usdRate && usdRate > 0 ? (
                <tr>
                  <td className="py-1 text-[11px] text-gray-500">USD equivalent (1 {est.currency} = {nf2(usdRate)} USD)</td>
                  <td className="py-1 text-right text-xs font-semibold tabular-nums text-gray-900">USD {nf0(t.grandTotal * usdRate)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {/* Cost per m² — built-up-area unit rates (matches the on-screen summary). */}
          {area > 0 ? (
            <div className="mt-3 border-t border-gray-200 pt-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Cost per m² · ÷ {nf0(area)} m²
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
                {[
                  { k: "Materials", v: t.grand.mat },
                  { k: "Labor", v: t.grand.labor },
                  { k: "Subcontractor", v: t.grand.sub },
                  { k: "Total", v: t.grandTotal },
                ].map((m) => (
                  <div key={m.k} className="flex items-baseline justify-between gap-1 sm:flex-col sm:items-start sm:gap-0">
                    <span className="text-gray-500">{m.k}</span>
                    <span className="font-semibold tabular-nums text-gray-900">
                      {usdRate && usdRate > 0 ? (
                        <span className="font-normal text-gray-400">USD {nf2((m.v / area) * usdRate)} · </span>
                      ) : null}
                      {est.currency} {nf2(m.v / area)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-2 text-[10px] text-gray-400">
            All amounts in {est.currency}. Profit &amp; Risk and BBO applied to direct cost
            {generalConditions ? " plus General Conditions / Overhead" : ""}.
          </p>
        </div>
      </div>

      {/* Prepared-by / acceptance */}
      <div className="mt-10 break-inside-avoid border-t border-gray-300 pt-6">
        <p className="text-xs text-gray-500">
          This cost estimate is indicative and based on the quantities and rates current at the date of issue.
          Final pricing is subject to design development, site conditions and supplier quotations.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-10">
          <div>
            <div className="h-px w-full bg-gray-400" />
            <div className="mt-1 text-xs text-gray-600">Prepared by — {firm}</div>
            <div className="text-[11px] text-gray-400">Estimator · Date</div>
          </div>
          <div>
            <div className="h-px w-full bg-gray-400" />
            <div className="mt-1 text-xs text-gray-600">Reviewed / Approved</div>
            <div className="text-[11px] text-gray-400">Name · Position · Date</div>
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
        {documentFooterLine(firm, `Cost Estimate ${est.id}`, est.version, est.location)}
      </div>
    </div>
  );
}
