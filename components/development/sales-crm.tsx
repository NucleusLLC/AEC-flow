"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { LeadStatusBadge } from "@/components/development/badges";
import { SaveControl } from "@/components/development/save-control";
import { rollupSales, sum } from "@/lib/development/calc";
import { uid } from "@/components/projects/dashboard/hooks";
import {
  RESERVATION_STATUS_LABEL,
  SALES_CONTRACT_STATUS_LABEL,
  type SalesLead, type LotInventory, type BuyerReservation, type SalesContract,
  type DevReservationStatus, type DevSalesContractStatus,
} from "@/lib/data/development.types";
import { formatCurrency, formatDate } from "@/lib/format";

const txt = "h-8 w-full rounded border border-transparent bg-transparent px-1.5 text-sm text-fg hover:border-border focus:border-brand focus:bg-surface focus:outline-none";
const numI = "h-8 w-full rounded border border-transparent bg-transparent px-1.5 text-right text-sm tabular-nums text-fg hover:border-border focus:border-brand focus:bg-surface focus:outline-none";
const sel = "h-8 rounded border border-border bg-surface px-1 text-xs";
const cell = "border-b border-border px-3 py-1.5";

export function SalesCrm({ projectId, leads, lots, reservations: r0, salesContracts: s0, currency }: { projectId: string; leads: SalesLead[]; lots: LotInventory[]; reservations: BuyerReservation[]; salesContracts: SalesContract[]; currency: string }) {
  const [reservations, setReservations] = useState<BuyerReservation[]>(r0);
  const [salesContracts, setSalesContracts] = useState<SalesContract[]>(s0);
  const sales = useMemo(() => {
    const sold = lots.filter((l) => l.status === "SOLD").length;
    const closed = lots.filter((l) => l.status === "CLOSED").length;
    const reserved = lots.filter((l) => l.status === "RESERVED" || l.status === "OPTIONED").length;
    const placed = lots.filter((l) => l.status === "SOLD" || l.status === "CLOSED");
    const placedValue = sum(placed.map((l) => l.areaM2 * (l.baseLandPricePerM2 + l.premiumAdjustmentPerM2)));
    const deposits = sum(placed.map((l) => l.areaM2 * (l.baseLandPricePerM2 + l.premiumAdjustmentPerM2) * (l.depositPct / 100)));
    return rollupSales({ totalLots: lots.length, reserved, sold, closed, totalSalesValue: placedValue, depositsCollected: deposits, soldPerMonth: 1.5 });
  }, [lots]);

  const commissionPayable = sum(leads.filter((l) => l.status === "WON").map((l) => l.budget * (l.commissionPct / 100)));

  const tiles = [
    { label: "Available", value: String(sales.available) },
    { label: "Reserved", value: String(sales.reserved) },
    { label: "Sold", value: String(sales.sold) },
    { label: "Closed", value: String(sales.closed) },
    { label: "Sales value", value: formatCurrency(sales.totalSalesValue, currency) },
    { label: "Deposits collected", value: formatCurrency(sales.depositsCollected, currency) },
    { label: "Balance receivable", value: formatCurrency(sales.balanceReceivable, currency) },
    { label: "Absorption", value: `${sales.absorptionRatePct.toFixed(0)}%` },
    { label: "Velocity", value: `${sales.salesVelocity}/mo` },
    { label: "Projected sellout", value: sales.projectedSelloutMonths != null ? `${sales.projectedSelloutMonths} mo` : "—" },
    { label: "Commission payable", value: formatCurrency(commissionPayable, currency) },
    { label: "Active leads", value: String(leads.filter((l) => l.status !== "LOST" && l.status !== "WON").length) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="card-surface rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wide text-muted">{t.label}</div>
            <div className="mt-0.5 text-sm font-semibold text-fg">{t.value}</div>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Lead pipeline" subtitle="Prospects, financing and reservation status" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 py-2.5 font-medium">Lead</th>
                <th className="px-3 py-2.5 font-medium">Interest</th>
                <th className="px-3 py-2.5 font-medium">Financing</th>
                <th className="px-3 py-2.5 text-right font-medium">Budget</th>
                <th className="px-3 py-2.5 text-right font-medium">Deposit</th>
                <th className="px-3 py-2.5 font-medium">Broker</th>
                <th className="px-3 py-2.5 font-medium">Follow-up</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leads.map((l) => (
                <tr key={l.id} className="even:bg-surface-2/40">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-fg">{l.name}</div>
                    <div className="text-[11px] text-faint">{l.contact ?? "—"}{l.source ? ` · ${l.source}` : ""}</div>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{l.interestedLot ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted">{l.financingStatus.replace(/_/g, " ").toLowerCase()}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-fg">{formatCurrency(l.budget, currency)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{l.depositReceived ? formatCurrency(l.depositReceived, currency) : "—"}</td>
                  <td className="px-3 py-2.5 text-muted">{l.broker ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted">{formatDate(l.followUpDate)}</td>
                  <td className="px-3 py-2.5"><LeadStatusBadge status={l.status} /></td>
                </tr>
              ))}
              {leads.length === 0 ? <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">No leads yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-fg">Reservations</h3>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setReservations((p) => [...p, { id: uid("res"), projectId, lotNumber: "", buyerName: "", contact: null, broker: null, depositAmount: 0, status: "ACTIVE", reservationDate: null, expiryDate: null, notes: null }])} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2"><Plus className="h-4 w-4" /> Add</button>
              <SaveControl url={`/api/development/${projectId}/reservations`} build={() => ({ reservations })} label="Save" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 py-2.5 font-medium">Lot</th><th className="px-3 py-2.5 font-medium">Buyer</th>
                <th className="px-3 py-2.5 text-right font-medium">Deposit</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5"></th>
              </tr></thead>
              <tbody>
                {reservations.map((r) => (
                  <tr key={r.id} className="even:bg-surface-2/40">
                    <td className={cell}><input className={`${txt} w-20`} value={r.lotNumber} onChange={(e) => setReservations((p) => p.map((x) => x.id === r.id ? { ...x, lotNumber: e.target.value } : x))} /></td>
                    <td className={cell}><input className={`${txt} w-32`} value={r.buyerName} onChange={(e) => setReservations((p) => p.map((x) => x.id === r.id ? { ...x, buyerName: e.target.value } : x))} /></td>
                    <td className={cell}><input type="number" className={numI} value={r.depositAmount} onChange={(e) => setReservations((p) => p.map((x) => x.id === r.id ? { ...x, depositAmount: Number(e.target.value) } : x))} /></td>
                    <td className={cell}><select className={sel} value={r.status} onChange={(e) => setReservations((p) => p.map((x) => x.id === r.id ? { ...x, status: e.target.value as DevReservationStatus } : x))}>{(Object.keys(RESERVATION_STATUS_LABEL) as DevReservationStatus[]).map((s) => <option key={s} value={s}>{RESERVATION_STATUS_LABEL[s]}</option>)}</select></td>
                    <td className={cell}><button type="button" onClick={() => setReservations((p) => p.filter((x) => x.id !== r.id))} className="text-faint hover:text-red-600" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
                {reservations.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">No reservations.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-fg">Sales contracts</h3>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setSalesContracts((p) => [...p, { id: uid("sc"), projectId, contractNumber: `SC-${p.length + 1}`, lotNumber: "", buyerName: "", salePrice: 0, depositPaid: 0, status: "DRAFT", signedDate: null, closingDate: null, notes: null }])} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2"><Plus className="h-4 w-4" /> Add</button>
              <SaveControl url={`/api/development/${projectId}/sales-contracts`} build={() => ({ salesContracts })} label="Save" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead><tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-3 py-2.5 font-medium">Contract</th><th className="px-3 py-2.5 font-medium">Lot</th>
                <th className="px-3 py-2.5 text-right font-medium">Price</th><th className="px-3 py-2.5 font-medium">Status</th><th className="px-3 py-2.5"></th>
              </tr></thead>
              <tbody>
                {salesContracts.map((c) => (
                  <tr key={c.id} className="even:bg-surface-2/40">
                    <td className={cell}><input className={`${txt} w-24`} value={c.contractNumber} onChange={(e) => setSalesContracts((p) => p.map((x) => x.id === c.id ? { ...x, contractNumber: e.target.value } : x))} /></td>
                    <td className={cell}><input className={`${txt} w-20`} value={c.lotNumber} onChange={(e) => setSalesContracts((p) => p.map((x) => x.id === c.id ? { ...x, lotNumber: e.target.value } : x))} /></td>
                    <td className={cell}><input type="number" className={numI} value={c.salePrice} onChange={(e) => setSalesContracts((p) => p.map((x) => x.id === c.id ? { ...x, salePrice: Number(e.target.value) } : x))} /></td>
                    <td className={cell}><select className={sel} value={c.status} onChange={(e) => setSalesContracts((p) => p.map((x) => x.id === c.id ? { ...x, status: e.target.value as DevSalesContractStatus } : x))}>{(Object.keys(SALES_CONTRACT_STATUS_LABEL) as DevSalesContractStatus[]).map((s) => <option key={s} value={s}>{SALES_CONTRACT_STATUS_LABEL[s]}</option>)}</select></td>
                    <td className={cell}><button type="button" onClick={() => setSalesContracts((p) => p.filter((x) => x.id !== c.id))} className="text-faint hover:text-red-600" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
                {salesContracts.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">No sales contracts.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
