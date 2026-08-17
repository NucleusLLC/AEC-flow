"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ProjectSelect } from "@/components/projects/project-select";
import { formatCurrency } from "@/lib/format";
import { poTotals, lineAmount } from "@/lib/procurement/calc";
import {
  PO_STATUSES,
  PO_STATUS_LABEL,
  type PurchaseOrderDTO,
  type PurchaseOrderInput,
  type PurchaseOrderLine,
  type PurchaseOrderStatus,
} from "@/lib/procurement/types";
import {
  createPurchaseOrderAction,
  updatePurchaseOrderAction,
} from "@/app/(app)/procurement/actions";

type ProjectOption = { id: string; name: string };

const CURRENCIES = ["USD", "AWG", "EUR", "ANG"];

const emptyLine: PurchaseOrderLine = { description: "", quantity: 1, unit: "", unitPrice: 0 };

const field =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const label = "mb-1 block text-xs font-medium text-muted";

export function PurchaseOrderForm({
  projects: projectProp,
  mode,
  initial,
}: {
  projects: ProjectOption[];
  mode: "new" | "edit";
  initial?: PurchaseOrderDTO;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Grown when a project is created from the picker.
  const [projects, setProjects] = useState(projectProp);

  const [vendorName, setVendorName] = useState(initial?.vendorName ?? "");
  const [vendorContact, setVendorContact] = useState(initial?.vendorContact ?? "");
  const [vendorEmail, setVendorEmail] = useState(initial?.vendorEmail ?? "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [status, setStatus] = useState<PurchaseOrderStatus>(initial?.status ?? "DRAFT");
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [orderDate, setOrderDate] = useState(initial?.orderDate ?? "");
  const [expectedDate, setExpectedDate] = useState(initial?.expectedDate ?? "");
  const [receivedDate, setReceivedDate] = useState(initial?.receivedDate ?? "");
  const [taxPercentage, setTaxPercentage] = useState(String(initial?.taxPercentage ?? 0));
  const [shipping, setShipping] = useState(String(initial?.shipping ?? 0));
  const [terms, setTerms] = useState(initial?.terms ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [lines, setLines] = useState<PurchaseOrderLine[]>(
    initial?.lineItems?.length ? initial.lineItems : [{ ...emptyLine }],
  );

  const totals = useMemo(
    () => poTotals({ lineItems: lines, taxPercentage: Number(taxPercentage) || 0, shipping: Number(shipping) || 0 }),
    [lines, taxPercentage, shipping],
  );

  function setLine(i: number, patch: Partial<PurchaseOrderLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, { ...emptyLine }]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const project = projects.find((p) => p.id === projectId);
    const input: PurchaseOrderInput = {
      projectId: projectId || null,
      projectName: project?.name ?? null,
      vendorName,
      vendorContact: vendorContact || null,
      vendorEmail: vendorEmail || null,
      status,
      currency,
      lineItems: lines,
      taxPercentage: Number(taxPercentage) || 0,
      shipping: Number(shipping) || 0,
      orderDate: orderDate || null,
      expectedDate: expectedDate || null,
      receivedDate: receivedDate || null,
      terms: terms || null,
      notes: notes || null,
    };
    start(async () => {
      const res =
        mode === "edit" && initial
          ? await updatePurchaseOrderAction(initial.id, input)
          : await createPurchaseOrderAction(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/procurement/${res.id}`);
      router.refresh();
    });
  }

  const money = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 2 });

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader title="Supplier" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className={label}>Vendor / supplier *</label>
            <input value={vendorName} onChange={(e) => setVendorName(e.target.value)} className={field} placeholder="Acme Building Supplies" />
          </div>
          <div>
            <label className={label}>Contact</label>
            <input value={vendorContact} onChange={(e) => setVendorContact(e.target.value)} className={field} placeholder="Jane Doe" />
          </div>
          <div>
            <label className={label}>Email</label>
            <input type="email" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} className={field} placeholder="orders@acme.com" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Order" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          {/* Optional — a purchase order need not belong to a project — so "— None —"
              stays a real choice. It is still creatable: wanting to file this
              against a project that does not exist yet is the common case, and
              leaving is the only thing the old select allowed. */}
          <ProjectSelect
            label="Project (optional)"
            projects={projects}
            value={projectId}
            onChange={setProjectId}
            onCreated={(p) => setProjects((prev) => [...prev, { id: p.id, name: p.projectName }])}
            allowEmpty
            placeholder="— None —"
          />
          <div>
            <label className={label}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as PurchaseOrderStatus)} className={field}>
              {PO_STATUSES.map((s) => (
                <option key={s} value={s}>{PO_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={field}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Order date</label>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Expected delivery</label>
            <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Received date</label>
            <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className={field} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Line items" subtitle="Quantity × unit price" />
        <CardBody className="space-y-2">
          <div className="hidden gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-faint sm:grid sm:grid-cols-[1fr_80px_80px_110px_110px_32px]">
            <span>Description</span>
            <span className="text-right">Qty</span>
            <span>Unit</span>
            <span className="text-right">Unit price</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_80px_80px_110px_110px_32px]">
              <input
                value={l.description}
                onChange={(e) => setLine(i, { description: e.target.value })}
                className={field}
                placeholder="Portland cement, 42.5N"
              />
              <input
                type="number"
                step="any"
                value={l.quantity}
                onChange={(e) => setLine(i, { quantity: Number(e.target.value) })}
                className={`${field} text-right`}
              />
              <input
                value={l.unit}
                onChange={(e) => setLine(i, { unit: e.target.value })}
                className={field}
                placeholder="bag"
              />
              <input
                type="number"
                step="any"
                value={l.unitPrice}
                onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })}
                className={`${field} text-right`}
              />
              <div className="flex h-9 items-center justify-end px-1 text-sm tabular-nums text-fg">
                {money(lineAmount(l))}
              </div>
              <button
                type="button"
                onClick={() => removeLine(i)}
                disabled={lines.length === 1}
                className="flex h-9 items-center justify-center rounded-lg text-muted hover:text-rose-600 disabled:opacity-30"
                aria-label="Remove line"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addLine}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-brand hover:text-fg"
          >
            <Plus className="h-4 w-4" /> Add line
          </button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Totals & terms" />
        <CardBody className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Tax %</label>
                <input type="number" step="any" value={taxPercentage} onChange={(e) => setTaxPercentage(e.target.value)} className={`${field} text-right`} />
              </div>
              <div>
                <label className={label}>Shipping</label>
                <input type="number" step="any" value={shipping} onChange={(e) => setShipping(e.target.value)} className={`${field} text-right`} />
              </div>
            </div>
            <div>
              <label className={label}>Payment terms</label>
              <input value={terms} onChange={(e) => setTerms(e.target.value)} className={field} placeholder="Net 30" />
            </div>
            <div>
              <label className={label}>Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${field} h-auto py-2`} />
            </div>
          </div>
          <dl className="space-y-2 self-start rounded-lg border border-border bg-surface-2/40 p-4 text-sm">
            <Row k="Subtotal" v={money(totals.subtotal)} />
            <Row k={`Tax (${Number(taxPercentage) || 0}%)`} v={money(totals.tax)} />
            <Row k="Shipping" v={money(totals.shipping)} />
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold text-fg">
              <dt>Total</dt>
              <dd className="tabular-nums">{money(totals.total)}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create purchase order"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-muted hover:text-fg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-muted">
      <dt>{k}</dt>
      <dd className="tabular-nums text-fg">{v}</dd>
    </div>
  );
}
