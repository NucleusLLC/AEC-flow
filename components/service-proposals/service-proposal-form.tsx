"use client";

import { useMemo, useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertTriangle, Info } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { computeProposal } from "@/lib/proposals/engine/engine";
import {
  COST_BASIS_LABEL,
  DEFAULT_PHASES,
  type CostBasisType,
  type ProposalCalcInput,
  type ServiceCategory,
} from "@/lib/proposals/engine/types";
import type { ServiceProposalDTO } from "@/lib/proposals/dto";
import {
  createServiceProposalAction,
  updateServiceProposalAction,
} from "@/app/(app)/design/service-proposals/actions";

type Option = { id: string; name: string };

const CURRENCIES = ["USD", "AWG", "EUR", "ANG"];
const BASIS_TYPES: CostBasisType[] = [
  "ESTIMATED_CONSTRUCTION_COST",
  "APPROVED_CONSTRUCTION_BUDGET",
  "CONTRACTOR_CONTRACT_SUM",
  "TOTAL_DEVELOPMENT_COST",
  "CUSTOM",
];

const field =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const label = "mb-1 block text-xs font-medium text-muted";

type FeeRow = {
  key: string;
  label: string;
  method: "PERCENT_OF_BASIS" | "FIXED";
  percent: string;
  fixedAmount: string;
  category: ServiceCategory;
  selected: boolean;
};
type PhaseRow = { key: string; name: string; percent: string };
type MilestoneRow = { key: string; name: string; percent: string };

let counter = 0;
const uid = () => `r${counter++}`;

export function ServiceProposalForm({
  clients,
  projects,
  mode,
  initial,
}: {
  clients: Option[];
  projects: Option[];
  mode: "new" | "edit";
  initial?: ServiceProposalDTO;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const nav = useRef<HTMLDivElement>(null);

  const init = initial?.input;

  const [title, setTitle] = useState(init?.title ?? "");
  const [clientId, setClientId] = useState(init?.clientId ?? "");
  const [projectId, setProjectId] = useState(init?.projectId ?? "");
  const [contactName, setContactName] = useState(init?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(init?.contactEmail ?? "");
  const [currency, setCurrency] = useState(init?.currency ?? "USD");

  const [basisType, setBasisType] = useState<CostBasisType>(
    init?.costBasis?.type ?? "ESTIMATED_CONSTRUCTION_COST",
  );
  const [basisAmount, setBasisAmount] = useState(String(init?.costBasis?.amount ?? ""));
  const [basisSourceField, setBasisSourceField] = useState(init?.costBasis?.sourceField ?? "");

  const [fees, setFees] = useState<FeeRow[]>(
    init?.feeComponents?.length
      ? init.feeComponents.map((c) => ({
          key: uid(),
          label: c.label,
          method: c.method === "FIXED" ? "FIXED" : "PERCENT_OF_BASIS",
          percent: c.percent != null ? String(c.percent) : "",
          fixedAmount: c.fixedAmount != null ? String(c.fixedAmount) : "",
          category: c.category,
          selected: c.selected ?? false,
        }))
      : [{ key: uid(), label: "Architectural design services", method: "PERCENT_OF_BASIS", percent: "", fixedAmount: "", category: "BASE", selected: false }],
  );

  const [phases, setPhases] = useState<PhaseRow[]>(
    init?.phases?.length
      ? init.phases.map((p) => ({ key: uid(), name: p.name, percent: String(p.percent) }))
      : DEFAULT_PHASES.map((p) => ({ key: uid(), name: p.name, percent: String(p.percentage) })),
  );

  const [milestones, setMilestones] = useState<MilestoneRow[]>(
    init?.paymentMilestones?.length
      ? init.paymentMilestones.map((m) => ({ key: uid(), name: m.name, percent: String(m.percent) }))
      : [],
  );

  const [taxName, setTaxName] = useState(init?.taxes?.[0]?.name ?? "");
  const [taxPercent, setTaxPercent] = useState(String(init?.taxes?.[0]?.percent ?? ""));

  const [discountLabel, setDiscountLabel] = useState(init?.discounts?.[0]?.label ?? "");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">(init?.discounts?.[0]?.type ?? "PERCENT");
  const [discountValue, setDiscountValue] = useState(String(init?.discounts?.[0]?.value ?? ""));

  const [scopeSummary, setScopeSummary] = useState(init?.scopeSummary ?? "");
  const [exclusions, setExclusions] = useState(init?.exclusions ?? "");
  const [assumptions, setAssumptions] = useState(init?.assumptions ?? "");
  const [terms, setTerms] = useState(init?.terms ?? "");
  const [validUntil, setValidUntil] = useState(init?.validUntil ?? "");
  const [showFeeDerivation, setShowFeeDerivation] = useState(init?.showFeeDerivation ?? true);

  // Build the exact engine input so the preview equals what the server will store.
  const calcInput: ProposalCalcInput = useMemo(() => {
    const anyPercent = fees.some((f) => f.method === "PERCENT_OF_BASIS");
    return {
      currency,
      costBasis: anyPercent
        ? {
            type: basisType,
            amount: Number(basisAmount) || 0,
            sourceField: basisSourceField || null,
          }
        : null,
      feeComponents: fees.map((f) => ({
        id: f.key,
        label: f.label || "Fee",
        method: f.method,
        category: f.category,
        percent: f.method === "PERCENT_OF_BASIS" ? Number(f.percent) || 0 : null,
        fixedAmount: f.method === "FIXED" ? Number(f.fixedAmount) || 0 : null,
        selected: f.selected,
      })),
      phases: phases.map((p) => ({ id: p.key, name: p.name, percent: Number(p.percent) || 0 })),
      paymentMilestones: milestones.map((m) => ({ id: m.key, name: m.name, percent: Number(m.percent) || 0 })),
      taxes: taxName && Number(taxPercent) > 0 ? [{ name: taxName, percent: Number(taxPercent), mode: "EXCLUSIVE" as const }] : [],
      discounts:
        discountLabel && Number(discountValue) > 0
          ? [{ id: "d", label: discountLabel, type: discountType, value: Number(discountValue) }]
          : [],
    };
  }, [currency, basisType, basisAmount, basisSourceField, fees, phases, milestones, taxName, taxPercent, discountLabel, discountType, discountValue]);

  const calc = useMemo(() => computeProposal(calcInput), [calcInput]);
  const money = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 2 });
  const anyPercent = fees.some((f) => f.method === "PERCENT_OF_BASIS");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const client = clients.find((c) => c.id === clientId);
    const project = projects.find((p) => p.id === projectId);
    const payload = {
      title,
      currency,
      clientId: clientId || null,
      clientName: client?.name ?? null,
      projectId: projectId || null,
      projectName: project?.name ?? null,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      costBasis: anyPercent
        ? { type: basisType, amount: Number(basisAmount) || 0, sourceField: basisSourceField || null }
        : null,
      feeComponents: fees.map((f) => ({
        id: f.key,
        label: f.label || "Fee",
        method: f.method,
        category: f.category,
        percent: f.method === "PERCENT_OF_BASIS" ? Number(f.percent) || 0 : null,
        fixedAmount: f.method === "FIXED" ? Number(f.fixedAmount) || 0 : null,
        selected: f.selected,
      })),
      phases: phases.map((p) => ({ id: p.key, name: p.name, percent: Number(p.percent) || 0 })),
      paymentMilestones: milestones.map((m) => ({ id: m.key, name: m.name, percent: Number(m.percent) || 0 })),
      taxes: taxName && Number(taxPercent) > 0 ? [{ name: taxName, percent: Number(taxPercent), mode: "EXCLUSIVE" }] : [],
      discounts:
        discountLabel && Number(discountValue) > 0
          ? [{ id: "d", label: discountLabel, type: discountType, value: Number(discountValue) }]
          : [],
      scopeSummary: scopeSummary || null,
      exclusions: exclusions || null,
      assumptions: assumptions || null,
      terms: terms || null,
      validUntil: validUntil || null,
      showFeeDerivation,
    };

    start(async () => {
      const res =
        mode === "edit" && initial
          ? await updateServiceProposalAction(initial.id, payload)
          : await createServiceProposalAction(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/design/service-proposals/${res.id}`);
      router.refresh();
    });
  }

  const phasePct = phases.reduce((s, p) => s + (Number(p.percent) || 0), 0);

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6" ref={nav}>
        {/* Proposal */}
        <Card>
          <CardHeader title="Proposal" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label}>Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="Architectural design services — Palm Beach Residence" />
            </div>
            <div>
              <label className={label}>Client</label>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={field}>
                <option value="">— None —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Project</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
                <option value="">— None —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Contact name</label>
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>Contact email</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={field} />
            </div>
            <div>
              <label className={label}>Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={field}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </CardBody>
        </Card>

        {/* Cost basis */}
        {anyPercent ? (
          <Card>
            <CardHeader title="Cost basis" subtitle="What the percentage fees are calculated from" />
            <CardBody className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className={label}>Basis *</label>
                <select value={basisType} onChange={(e) => setBasisType(e.target.value as CostBasisType)} className={field}>
                  {BASIS_TYPES.map((b) => <option key={b} value={b}>{COST_BASIS_LABEL[b]}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Amount *</label>
                <input type="number" step="any" min="0" value={basisAmount} onChange={(e) => setBasisAmount(e.target.value)} className={`${field} text-right`} placeholder="2500000" />
              </div>
              <div className="sm:col-span-3">
                <label className={label}>Source note (e.g. which estimate figure)</label>
                <input value={basisSourceField} onChange={(e) => setBasisSourceField(e.target.value)} className={field} placeholder="Estimate EST-2026-014 — direct cost" />
              </div>
            </CardBody>
          </Card>
        ) : null}

        {/* Fees */}
        <Card>
          <CardHeader title="Professional fees" subtitle="One line per discipline or service" />
          <CardBody className="space-y-2">
            {fees.map((f) => (
              <div key={f.key} className="rounded-lg border border-border p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_130px_110px_40px]">
                  <input value={f.label} onChange={(e) => setFees((p) => p.map((x) => x.key === f.key ? { ...x, label: e.target.value } : x))} className={field} placeholder="Architecture" />
                  <select value={f.method} onChange={(e) => setFees((p) => p.map((x) => x.key === f.key ? { ...x, method: e.target.value as FeeRow["method"] } : x))} className={field}>
                    <option value="PERCENT_OF_BASIS">% of basis</option>
                    <option value="FIXED">Fixed fee</option>
                  </select>
                  {f.method === "PERCENT_OF_BASIS" ? (
                    <input type="number" step="any" min="0" value={f.percent} onChange={(e) => setFees((p) => p.map((x) => x.key === f.key ? { ...x, percent: e.target.value } : x))} className={`${field} text-right`} placeholder="7.5" />
                  ) : (
                    <input type="number" step="any" min="0" value={f.fixedAmount} onChange={(e) => setFees((p) => p.map((x) => x.key === f.key ? { ...x, fixedAmount: e.target.value } : x))} className={`${field} text-right`} placeholder="55000" />
                  )}
                  <button type="button" onClick={() => setFees((p) => p.length === 1 ? p : p.filter((x) => x.key !== f.key))} disabled={fees.length === 1} className="flex h-9 items-center justify-center rounded-lg text-muted hover:text-rose-600 disabled:opacity-30" aria-label="Remove fee"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-muted">
                  <label className="inline-flex items-center gap-1.5">
                    <span>Type</span>
                    <select value={f.category} onChange={(e) => setFees((p) => p.map((x) => x.key === f.key ? { ...x, category: e.target.value as ServiceCategory } : x))} className="h-7 rounded border border-border bg-surface px-2 text-xs">
                      <option value="BASE">Base</option>
                      <option value="OPTIONAL">Optional</option>
                      <option value="ADDITIONAL">Additional</option>
                    </select>
                  </label>
                  {f.category === "OPTIONAL" ? (
                    <label className="inline-flex items-center gap-1.5">
                      <input type="checkbox" checked={f.selected} onChange={(e) => setFees((p) => p.map((x) => x.key === f.key ? { ...x, selected: e.target.checked } : x))} />
                      <span>Selected (include in total)</span>
                    </label>
                  ) : null}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setFees((p) => [...p, { key: uid(), label: "", method: "PERCENT_OF_BASIS", percent: "", fixedAmount: "", category: "BASE", selected: false }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-brand hover:text-fg">
              <Plus className="h-4 w-4" /> Add fee line
            </button>
          </CardBody>
        </Card>

        {/* Phases */}
        <Card>
          <CardHeader title="Design phases" subtitle="How the base fee is distributed — should total 100%" />
          <CardBody className="space-y-2">
            {phases.map((ph) => (
              <div key={ph.key} className="grid gap-2 sm:grid-cols-[1fr_100px_120px_40px]">
                <input value={ph.name} onChange={(e) => setPhases((p) => p.map((x) => x.key === ph.key ? { ...x, name: e.target.value } : x))} className={field} />
                <input type="number" step="any" min="0" value={ph.percent} onChange={(e) => setPhases((p) => p.map((x) => x.key === ph.key ? { ...x, percent: e.target.value } : x))} className={`${field} text-right`} />
                <div className="flex h-9 items-center justify-end px-1 text-sm tabular-nums text-muted">
                  {money((calc.totals.baseFeeTotal * (Number(ph.percent) || 0)) / 100)}
                </div>
                <button type="button" onClick={() => setPhases((p) => p.length === 1 ? p : p.filter((x) => x.key !== ph.key))} disabled={phases.length === 1} className="flex h-9 items-center justify-center rounded-lg text-muted hover:text-rose-600 disabled:opacity-30" aria-label="Remove phase"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <div className="flex items-center gap-3 pt-1">
              <button type="button" onClick={() => setPhases((p) => [...p, { key: uid(), name: "", percent: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-brand hover:text-fg">
                <Plus className="h-4 w-4" /> Add phase
              </button>
              <span className={`ml-auto text-sm tabular-nums ${Math.abs(phasePct - 100) < 0.005 ? "text-muted" : "font-medium text-amber-600 dark:text-amber-400"}`}>
                Total {Math.round(phasePct * 100) / 100}%{Math.abs(phasePct - 100) < 0.005 ? "" : " — should be 100%"}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Payment schedule */}
        <Card>
          <CardHeader title="Payment schedule" subtitle="Optional — should total 100% of the grand total" />
          <CardBody className="space-y-2">
            {milestones.length === 0 ? (
              <p className="text-sm text-muted">No payment milestones yet.</p>
            ) : milestones.map((m) => (
              <div key={m.key} className="grid gap-2 sm:grid-cols-[1fr_100px_120px_40px]">
                <input value={m.name} onChange={(e) => setMilestones((p) => p.map((x) => x.key === m.key ? { ...x, name: e.target.value } : x))} className={field} placeholder="On acceptance" />
                <input type="number" step="any" min="0" value={m.percent} onChange={(e) => setMilestones((p) => p.map((x) => x.key === m.key ? { ...x, percent: e.target.value } : x))} className={`${field} text-right`} />
                <div className="flex h-9 items-center justify-end px-1 text-sm tabular-nums text-muted">
                  {money((calc.totals.grandTotal * (Number(m.percent) || 0)) / 100)}
                </div>
                <button type="button" onClick={() => setMilestones((p) => p.filter((x) => x.key !== m.key))} className="flex h-9 items-center justify-center rounded-lg text-muted hover:text-rose-600" aria-label="Remove milestone"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button type="button" onClick={() => setMilestones((p) => [...p, { key: uid(), name: "", percent: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted hover:border-brand hover:text-fg">
              <Plus className="h-4 w-4" /> Add milestone
            </button>
          </CardBody>
        </Card>

        {/* Tax & discount */}
        <Card>
          <CardHeader title="Tax & discount" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Tax name</label>
                <input value={taxName} onChange={(e) => setTaxName(e.target.value)} className={field} placeholder="BBO" />
              </div>
              <div>
                <label className={label}>Tax %</label>
                <input type="number" step="any" min="0" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} className={`${field} text-right`} />
              </div>
            </div>
            <div className="grid grid-cols-[1fr_90px_90px] gap-3">
              <div>
                <label className={label}>Discount</label>
                <input value={discountLabel} onChange={(e) => setDiscountLabel(e.target.value)} className={field} placeholder="Repeat client" />
              </div>
              <div>
                <label className={label}>Type</label>
                <select value={discountType} onChange={(e) => setDiscountType(e.target.value as "PERCENT" | "FIXED")} className={field}>
                  <option value="PERCENT">%</option>
                  <option value="FIXED">Fixed</option>
                </select>
              </div>
              <div>
                <label className={label}>Value</label>
                <input type="number" step="any" min="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} className={`${field} text-right`} />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Scope & terms */}
        <Card>
          <CardHeader title="Scope & terms" />
          <CardBody className="space-y-3">
            <div>
              <label className={label}>Scope summary</label>
              <textarea value={scopeSummary} onChange={(e) => setScopeSummary(e.target.value)} rows={3} className={`${field} h-auto py-2`} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>Exclusions</label>
                <textarea value={exclusions} onChange={(e) => setExclusions(e.target.value)} rows={2} className={`${field} h-auto py-2`} />
              </div>
              <div>
                <label className={label}>Assumptions</label>
                <textarea value={assumptions} onChange={(e) => setAssumptions(e.target.value)} rows={2} className={`${field} h-auto py-2`} />
              </div>
            </div>
            <div>
              <label className={label}>Terms & conditions</label>
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} className={`${field} h-auto py-2`} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>Valid until</label>
                <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={field} />
              </div>
              <label className="flex items-end gap-2 pb-1.5 text-sm text-muted">
                <input type="checkbox" checked={showFeeDerivation} onChange={(e) => setShowFeeDerivation(e.target.checked)} />
                Show fee derivation to the client
              </label>
            </div>
          </CardBody>
        </Card>

        {error ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50">
            {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create proposal"}
          </button>
          <button type="button" onClick={() => router.back()} className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-muted hover:text-fg">Cancel</button>
        </div>
      </div>

      {/* Live summary rail */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-semibold text-fg">Live summary</h3>
          <dl className="mt-3 space-y-1.5 text-sm">
            <Row k="Base fee" v={money(calc.totals.baseFeeTotal)} />
            {calc.totals.optionalServicesTotal > 0 ? (
              <Row k="Optional (selected)" v={money(calc.totals.optionalSelectedTotal)} muted />
            ) : null}
            {calc.totals.reimbursablesTotal > 0 ? <Row k="Reimbursables" v={money(calc.totals.reimbursablesTotal)} /> : null}
            <Row k="Subtotal" v={money(calc.totals.subtotal)} />
            {calc.totals.discountTotal > 0 ? <Row k="Discount" v={`− ${money(calc.totals.discountTotal)}`} /> : null}
            {calc.totals.taxTotal > 0 ? <Row k={`Tax`} v={money(calc.totals.taxTotal)} /> : null}
            <div className="mt-1.5 flex justify-between border-t border-border pt-2 text-base font-semibold text-fg">
              <dt>Grand total</dt>
              <dd className="tabular-nums">{money(calc.totals.grandTotal)}</dd>
            </div>
          </dl>

          {calc.totals.optionalServicesTotal - calc.totals.optionalSelectedTotal > 0 ? (
            <p className="mt-2 text-xs text-muted">
              + {money(calc.totals.optionalServicesTotal - calc.totals.optionalSelectedTotal)} in unselected options
            </p>
          ) : null}

          {calc.errors.length > 0 ? (
            <div className="mt-3 space-y-1 rounded-lg border border-rose-500/30 bg-rose-500/5 p-2.5 text-xs text-rose-700 dark:text-rose-400">
              {calc.errors.map((e, i) => (
                <div key={i} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {e.message}</div>
              ))}
            </div>
          ) : null}
          {calc.warnings.length > 0 ? (
            <div className="mt-3 space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
              {calc.warnings.map((w, i) => (
                <div key={i} className="flex gap-1.5"><Info className="mt-0.5 h-3 w-3 shrink-0" /> {w.message}</div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function Row({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted" : "text-muted"}`}>
      <dt>{k}</dt>
      <dd className="tabular-nums text-fg">{v}</dd>
    </div>
  );
}
