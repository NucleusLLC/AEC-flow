"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SaveControl } from "@/components/development/save-control";
import {
  CONTRACT_STATUS_LABEL, INVOICE_STATUS_LABEL,
  type Vendor, type DevContract, type DevInvoice, type DevPayment,
  type DevContractStatus, type DevInvoiceStatus,
} from "@/lib/data/development.types";
import { formatCurrency } from "@/lib/format";
import { uid } from "@/components/projects/dashboard/hooks";

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
const cell = "border-b border-border px-2 py-1.5";
const txt = "h-8 w-full rounded border border-transparent bg-transparent px-1.5 text-sm text-fg hover:border-border focus:border-brand focus:bg-surface focus:outline-none";
const numI = "h-8 w-full rounded border border-transparent bg-transparent px-1.5 text-right text-sm tabular-nums text-fg hover:border-border focus:border-brand focus:bg-surface focus:outline-none";
const sel = "h-8 rounded border border-border bg-surface px-1 text-xs";

export function ProcurementView({
  projectId, vendors: v0, contracts: c0, invoices: i0, payments: p0, currency,
}: {
  projectId: string; vendors: Vendor[]; contracts: DevContract[]; invoices: DevInvoice[]; payments: DevPayment[]; currency: string;
}) {
  const [vendors, setVendors] = useState<Vendor[]>(v0);
  const [contracts, setContracts] = useState<DevContract[]>(c0);
  const [invoices, setInvoices] = useState<DevInvoice[]>(i0);
  const [payments, setPayments] = useState<DevPayment[]>(p0);

  const contracted = useMemo(() => sum(contracts.map((c) => c.value)), [contracts]);
  const invoiced = useMemo(() => sum(invoices.map((i) => i.amount)), [invoices]);
  const paid = useMemo(() => sum(payments.map((p) => p.amount)), [payments]);
  const retention = useMemo(() => sum(contracts.map((c) => c.value * (c.retentionPct / 100))), [contracts]);

  const tiles = [
    { label: "Contracted", value: formatCurrency(contracted, currency) },
    { label: "Invoiced", value: formatCurrency(invoiced, currency) },
    { label: "Paid", value: formatCurrency(paid, currency) },
    { label: "Outstanding", value: formatCurrency(invoiced - paid, currency) },
    { label: "Retention held", value: formatCurrency(retention, currency) },
    { label: "Vendors", value: String(vendors.length) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className="card-surface rounded-[var(--radius-card)] border border-border bg-surface px-3 py-2.5">
            <div className="text-[11px] uppercase tracking-wide text-muted">{t.label}</div>
            <div className="mt-0.5 text-sm font-semibold text-fg">{t.value}</div>
          </div>
        ))}
      </div>

      {/* Contracts */}
      <Section title="Contracts" onAdd={() => setContracts((p) => [...p, { id: uid("ct"), projectId, contractRef: `C-${p.length + 1}`, title: "New contract", vendorName: null, costCode: 5000, value: 0, retentionPct: 0, status: "DRAFT", startDate: null, endDate: null, notes: null }])}
        save={<SaveControl url={`/api/development/${projectId}/contracts`} build={() => ({ contracts })} label="Save contracts" />}
        head={["Ref", "Title", "Vendor", "Code", "Value", "Ret %", "Status", ""]}>
        {contracts.map((c) => (
          <tr key={c.id} className="even:bg-surface-2/40">
            <td className={cell}><input className={`${txt} w-24`} value={c.contractRef} onChange={(e) => setContracts((p) => p.map((x) => x.id === c.id ? { ...x, contractRef: e.target.value } : x))} /></td>
            <td className={cell}><input className={`${txt} w-40`} value={c.title} onChange={(e) => setContracts((p) => p.map((x) => x.id === c.id ? { ...x, title: e.target.value } : x))} /></td>
            <td className={cell}><input className={`${txt} w-32`} value={c.vendorName ?? ""} onChange={(e) => setContracts((p) => p.map((x) => x.id === c.id ? { ...x, vendorName: e.target.value } : x))} /></td>
            <td className={cell}><input type="number" className={`${numI} w-16`} value={c.costCode ?? 0} onChange={(e) => setContracts((p) => p.map((x) => x.id === c.id ? { ...x, costCode: Number(e.target.value) } : x))} /></td>
            <td className={cell}><input type="number" className={numI} value={c.value} onChange={(e) => setContracts((p) => p.map((x) => x.id === c.id ? { ...x, value: Number(e.target.value) } : x))} /></td>
            <td className={cell}><input type="number" className={`${numI} w-14`} value={c.retentionPct} onChange={(e) => setContracts((p) => p.map((x) => x.id === c.id ? { ...x, retentionPct: Number(e.target.value) } : x))} /></td>
            <td className={cell}><select className={sel} value={c.status} onChange={(e) => setContracts((p) => p.map((x) => x.id === c.id ? { ...x, status: e.target.value as DevContractStatus } : x))}>{(Object.keys(CONTRACT_STATUS_LABEL) as DevContractStatus[]).map((s) => <option key={s} value={s}>{CONTRACT_STATUS_LABEL[s]}</option>)}</select></td>
            <td className={cell}><Del onClick={() => setContracts((p) => p.filter((x) => x.id !== c.id))} /></td>
          </tr>
        ))}
      </Section>

      {/* Invoices */}
      <Section title="Invoices" onAdd={() => setInvoices((p) => [...p, { id: uid("inv"), projectId, invoiceNumber: `INV-${p.length + 1}`, contractRef: null, vendorName: null, costCode: 5000, amount: 0, status: "DRAFT", dateIssued: null, dateDue: null }])}
        save={<SaveControl url={`/api/development/${projectId}/invoices`} build={() => ({ invoices })} label="Save invoices" />}
        head={["Invoice", "Vendor", "Contract", "Code", "Amount", "Status", ""]}>
        {invoices.map((i) => (
          <tr key={i.id} className="even:bg-surface-2/40">
            <td className={cell}><input className={`${txt} w-28`} value={i.invoiceNumber} onChange={(e) => setInvoices((p) => p.map((x) => x.id === i.id ? { ...x, invoiceNumber: e.target.value } : x))} /></td>
            <td className={cell}><input className={`${txt} w-32`} value={i.vendorName ?? ""} onChange={(e) => setInvoices((p) => p.map((x) => x.id === i.id ? { ...x, vendorName: e.target.value } : x))} /></td>
            <td className={cell}><input className={`${txt} w-24`} value={i.contractRef ?? ""} onChange={(e) => setInvoices((p) => p.map((x) => x.id === i.id ? { ...x, contractRef: e.target.value } : x))} /></td>
            <td className={cell}><input type="number" className={`${numI} w-16`} value={i.costCode ?? 0} onChange={(e) => setInvoices((p) => p.map((x) => x.id === i.id ? { ...x, costCode: Number(e.target.value) } : x))} /></td>
            <td className={cell}><input type="number" className={numI} value={i.amount} onChange={(e) => setInvoices((p) => p.map((x) => x.id === i.id ? { ...x, amount: Number(e.target.value) } : x))} /></td>
            <td className={cell}><select className={sel} value={i.status} onChange={(e) => setInvoices((p) => p.map((x) => x.id === i.id ? { ...x, status: e.target.value as DevInvoiceStatus } : x))}>{(Object.keys(INVOICE_STATUS_LABEL) as DevInvoiceStatus[]).map((s) => <option key={s} value={s}>{INVOICE_STATUS_LABEL[s]}</option>)}</select></td>
            <td className={cell}><Del onClick={() => setInvoices((p) => p.filter((x) => x.id !== i.id))} /></td>
          </tr>
        ))}
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Payments */}
        <Section title="Payments" onAdd={() => setPayments((p) => [...p, { id: uid("pay"), projectId, invoiceNumber: null, vendorName: null, amount: 0, method: "Bank transfer", reference: null, datePaid: null }])}
          save={<SaveControl url={`/api/development/${projectId}/payments`} build={() => ({ payments })} label="Save" />}
          head={["Invoice", "Vendor", "Amount", ""]} minW={420}>
          {payments.map((p) => (
            <tr key={p.id} className="even:bg-surface-2/40">
              <td className={cell}><input className={`${txt} w-28`} value={p.invoiceNumber ?? ""} onChange={(e) => setPayments((x) => x.map((y) => y.id === p.id ? { ...y, invoiceNumber: e.target.value } : y))} /></td>
              <td className={cell}><input className={`${txt} w-32`} value={p.vendorName ?? ""} onChange={(e) => setPayments((x) => x.map((y) => y.id === p.id ? { ...y, vendorName: e.target.value } : y))} /></td>
              <td className={cell}><input type="number" className={numI} value={p.amount} onChange={(e) => setPayments((x) => x.map((y) => y.id === p.id ? { ...y, amount: Number(e.target.value) } : y))} /></td>
              <td className={cell}><Del onClick={() => setPayments((x) => x.filter((y) => y.id !== p.id))} /></td>
            </tr>
          ))}
        </Section>

        {/* Vendors */}
        <Section title="Vendors" onAdd={() => setVendors((p) => [...p, { id: uid("vnd"), projectId, name: "New vendor", trade: null, contact: null, email: null, phone: null, notes: null }])}
          save={<SaveControl url={`/api/development/${projectId}/vendors`} build={() => ({ vendors })} label="Save" />}
          head={["Name", "Trade", "Contact", ""]} minW={420}>
          {vendors.map((v) => (
            <tr key={v.id} className="even:bg-surface-2/40">
              <td className={cell}><input className={`${txt} w-32`} value={v.name} onChange={(e) => setVendors((p) => p.map((x) => x.id === v.id ? { ...x, name: e.target.value } : x))} /></td>
              <td className={cell}><input className={`${txt} w-28`} value={v.trade ?? ""} onChange={(e) => setVendors((p) => p.map((x) => x.id === v.id ? { ...x, trade: e.target.value } : x))} /></td>
              <td className={cell}><input className={`${txt} w-36`} value={v.contact ?? ""} onChange={(e) => setVendors((p) => p.map((x) => x.id === v.id ? { ...x, contact: e.target.value } : x))} /></td>
              <td className={cell}><Del onClick={() => setVendors((p) => p.filter((x) => x.id !== v.id))} /></td>
            </tr>
          ))}
        </Section>
      </div>
      <p className="px-1 text-[11px] text-faint">Tables edit and roll up instantly; each section saves independently to the live database.</p>
    </div>
  );
}

function Section({ title, head, onAdd, save, minW = 720, children }: { title: string; head: string[]; onAdd: () => void; save: React.ReactNode; minW?: number; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onAdd} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg hover:bg-surface-2"><Plus className="h-4 w-4" /> Add</button>
          {save}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: minW }}>
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
              {head.map((h, i) => <th key={i} className={`px-2 py-2 font-medium ${h && i === 4 ? "text-right" : ""}`}>{h}</th>)}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </Card>
  );
}

function Del({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="text-faint hover:text-red-600" aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></button>;
}
