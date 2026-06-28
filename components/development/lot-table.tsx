"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SaveControl } from "@/components/development/save-control";
import { CsvImport } from "@/components/development/csv-import";
import { withHeader, csvNum } from "@/lib/development/csv";
import { computeLot, rollupLots } from "@/lib/development/calc";
import { LOT_STATUS_LABEL, type LotInventory, type LotStatus } from "@/lib/data/development.types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { uid } from "@/components/projects/dashboard/hooks";

type Row = LotInventory;

const cell = "border-b border-border px-2 py-1.5";
const numInput =
  "h-8 w-full rounded border border-transparent bg-transparent px-1.5 text-right text-sm tabular-nums text-fg hover:border-border focus:border-brand focus:bg-surface focus:outline-none";
const txtInput =
  "h-8 w-full rounded border border-transparent bg-transparent px-1.5 text-sm text-fg hover:border-border focus:border-brand focus:bg-surface focus:outline-none";

export function LotTable({
  projectId,
  lots,
  costPerNetM2,
  currency,
}: {
  projectId: string;
  lots: LotInventory[];
  costPerNetM2: number;
  currency: string;
}) {
  const [rows, setRows] = useState<Row[]>(lots);

  const set = (id: string, k: keyof Row, v: string | number) =>
    setRows((p) => p.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  const remove = (id: string) => setRows((p) => p.filter((r) => r.id !== id));
  const add = () =>
    setRows((p) => [
      ...p,
      {
        id: uid("lot"), projectId, lotNumber: `L-${String(p.length + 1).padStart(2, "0")}`, phase: "Phase 1",
        block: null, lotType: "RESIDENTIAL", areaM2: 0, frontage: null, depth: null, cornerLot: false, viewPremium: false,
        baseLandPricePerM2: 450, premiumAdjustmentPerM2: 0, allocatedLandCost: 0, allocatedInfraCost: 0, allocatedSoftCost: 0,
        status: "DRAFT", buyerName: null, broker: null, reservationDate: null, agreementDate: null, closingDate: null,
        depositPct: 0, paymentStatus: "NONE", notes: null,
      },
    ]);

  const importCsv = (rows: string[][]): number => {
    const { records } = withHeader(rows, ["lotNumber", "area", "basePrice", "premium", "phase", "status"]);
    const valid = new Set(Object.keys(LOT_STATUS_LABEL));
    const mapped: Row[] = records.map((r, i) => {
      const status = (r.status || "").toUpperCase();
      return {
        id: uid("lot"), projectId, lotNumber: r.lotnumber || `L-${String(rows.length + i).padStart(2, "0")}`,
        phase: r.phase || null, block: null, lotType: "RESIDENTIAL", areaM2: csvNum(r.area), frontage: null, depth: null,
        cornerLot: false, viewPremium: false, baseLandPricePerM2: csvNum(r.baseprice) || 450,
        premiumAdjustmentPerM2: csvNum(r.premium), allocatedLandCost: 0, allocatedInfraCost: 0, allocatedSoftCost: 0,
        status: (valid.has(status) ? status : "DRAFT") as LotStatus, buyerName: null, broker: null,
        reservationDate: null, agreementDate: null, closingDate: null, depositPct: 0, paymentStatus: "NONE", notes: null,
      };
    });
    setRows((p) => [...p, ...mapped]);
    return mapped.length;
  };

  const computed = useMemo(
    () => rows.map((r) => ({ row: r, calc: computeLot({ areaM2: r.areaM2, baseLandPricePerM2: r.baseLandPricePerM2, premiumAdjustmentPerM2: r.premiumAdjustmentPerM2, allocatedCostPerM2: costPerNetM2 }) })),
    [rows, costPerNetM2],
  );
  const totals = useMemo(
    () => rollupLots(rows.map((r) => ({ areaM2: r.areaM2, baseLandPricePerM2: r.baseLandPricePerM2, premiumAdjustmentPerM2: r.premiumAdjustmentPerM2, allocatedCostPerM2: costPerNetM2 }))),
    [rows, costPerNetM2],
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">Lot inventory</h3>
          <p className="text-xs text-muted">Allocated cost = area × {formatCurrency(costPerNetM2, currency)}/m² (project cost per net sellable m²).</p>
        </div>
        <div className="flex items-center gap-2">
          <CsvImport onRows={importCsv} hint="Columns: lotNumber, area, basePrice, premium, phase, status" />
          <button type="button" onClick={add} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2">
            <Plus className="h-4 w-4" /> Add lot
          </button>
          <SaveControl url={`/api/development/${projectId}/lots`} build={() => ({ lots: rows })} label="Save lots" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
              <th className="px-2 py-2 font-medium">Lot</th>
              <th className="px-2 py-2 font-medium">Phase</th>
              <th className="px-2 py-2 text-right font-medium">Area m²</th>
              <th className="px-2 py-2 text-right font-medium">Base /m²</th>
              <th className="px-2 py-2 text-right font-medium">Premium</th>
              <th className="px-2 py-2 text-right font-medium">Final /m²</th>
              <th className="px-2 py-2 text-right font-medium">Sales price</th>
              <th className="px-2 py-2 text-right font-medium">Alloc. cost</th>
              <th className="px-2 py-2 text-right font-medium">Profit</th>
              <th className="px-2 py-2 text-right font-medium">Margin</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {computed.map(({ row: r, calc: c }) => (
              <tr key={r.id} className="even:bg-surface-2/40">
                <td className={cell}><input className={`${txtInput} w-20`} value={r.lotNumber} onChange={(e) => set(r.id, "lotNumber", e.target.value)} /></td>
                <td className={cell}><input className={`${txtInput} w-24`} value={r.phase ?? ""} onChange={(e) => set(r.id, "phase", e.target.value)} /></td>
                <td className={cell}><input type="number" className={numInput} value={r.areaM2} onChange={(e) => set(r.id, "areaM2", Number(e.target.value))} /></td>
                <td className={cell}><input type="number" className={numInput} value={r.baseLandPricePerM2} onChange={(e) => set(r.id, "baseLandPricePerM2", Number(e.target.value))} /></td>
                <td className={cell}><input type="number" className={numInput} value={r.premiumAdjustmentPerM2} onChange={(e) => set(r.id, "premiumAdjustmentPerM2", Number(e.target.value))} /></td>
                <td className={`${cell} text-right tabular-nums text-muted`}>{formatNumber(c.finalSalesPricePerM2)}</td>
                <td className={`${cell} text-right tabular-nums text-fg`}>{formatCurrency(c.totalSalesPrice, currency)}</td>
                <td className={`${cell} text-right tabular-nums text-muted`}>{formatCurrency(c.totalAllocatedCost, currency)}</td>
                <td className={`${cell} text-right font-medium tabular-nums ${c.grossProfit < 0 ? "text-red-600" : "text-emerald-600"}`}>{formatCurrency(c.grossProfit, currency)}</td>
                <td className={`${cell} text-right tabular-nums ${c.grossMarginPct < 0 ? "text-red-600" : "text-muted"}`}>{c.grossMarginPct.toFixed(1)}%</td>
                <td className={cell}>
                  <select className="h-8 rounded border border-border bg-surface px-1.5 text-xs" value={r.status} onChange={(e) => set(r.id, "status", e.target.value as LotStatus)}>
                    {(Object.keys(LOT_STATUS_LABEL) as LotStatus[]).map((s) => <option key={s} value={s}>{LOT_STATUS_LABEL[s]}</option>)}
                  </select>
                </td>
                <td className={cell}>
                  <button type="button" onClick={() => remove(r.id)} className="text-faint hover:text-red-600" aria-label="Remove lot"><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-surface-2 font-semibold">
              <td className="px-2 py-2.5" colSpan={2}>Totals · {totals.count} lots</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{formatNumber(totals.totalArea)}</td>
              <td className="px-2 py-2.5 text-right text-[11px] font-normal text-muted" colSpan={3}>wavg {formatNumber(totals.weightedAvgSalesPricePerM2)}/m²</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{formatCurrency(totals.totalRevenue, currency)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{formatCurrency(totals.totalCost, currency)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums text-emerald-700">{formatCurrency(totals.totalProfit, currency)}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{totals.avgMarginPct.toFixed(1)}%</td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-4 py-2 text-[11px] text-faint">Edits recalculate instantly. Use “Save lots” to persist (requires the database to be live).</p>
    </Card>
  );
}
