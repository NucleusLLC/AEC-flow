"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { Check, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { changeOrderBreakdown, revisedContractValue } from "@/lib/ca/calc";
import { CHANGE_ORDER_STATUS_LABEL } from "@/lib/ca/labels";
import type { ChangeOrder, ChangeOrderStatus } from "@/lib/ca/types";
import { currencyOptions, formatCurrency, getSystemCurrency } from "@/lib/format";
import { firmName } from "@/lib/firm-identity";

type ProjectOption = { id: string; name: string; value: number };

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

type Values = {
  projectId: string;
  title: string;
  reason: string;
  description: string;
  requestedBy: string;
  contractor: string;
  architect: string;
  engineer: string;
  owner: string;
  status: ChangeOrderStatus;
  currency: string;
  costLabor: number;
  costMaterial: number;
  costEquipment: number;
  costSubcontractor: number;
  overheadPercentage: number;
  profitPercentage: number;
  contingencyPercentage: number;
  vatPercentage: number;
  scheduleImpactDays: number;
  originalContractValue: number;
  approvedChangeOrdersToDate: number;
  notes: string;
};

/** Other codes offered alongside the System Currency, which always leads the list. */
const OTHER_CURRENCIES = ["USD", "AED", "EUR", "ANG", "AWG", "COP"];

function MoneyLine({ label, value, currency, strong }: { label: string; value: number; currency: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={strong ? "font-semibold text-fg" : "text-fg"}>{formatCurrency(value, currency)}</span>
    </div>
  );
}

export function ChangeOrderForm({
  projects,
  mode,
  initial,
  changeOrderId,
}: {
  projects: ProjectOption[];
  mode: "new" | "edit";
  initial?: Partial<Values>;
  changeOrderId?: string;
}) {
  const router = useRouter();
  const [result, setResult] = useState<{ ok: boolean; co?: ChangeOrder; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, control, setValue } = useForm<Values>({
    defaultValues: {
      projectId: "",
      title: "",
      reason: "",
      description: "",
      requestedBy: "",
      contractor: "",
      architect: firmName(),
      engineer: "",
      owner: "",
      status: "DRAFT",
      currency: getSystemCurrency(),
      costLabor: 0,
      costMaterial: 0,
      costEquipment: 0,
      costSubcontractor: 0,
      overheadPercentage: 8,
      profitPercentage: 6,
      contingencyPercentage: 3,
      vatPercentage: 0,
      scheduleImpactDays: 0,
      originalContractValue: 0,
      approvedChangeOrdersToDate: 0,
      notes: "",
      ...initial,
    },
  });

  const v = useWatch({ control });
  const breakdown = changeOrderBreakdown({
    costLabor: Number(v.costLabor) || 0,
    costMaterial: Number(v.costMaterial) || 0,
    costEquipment: Number(v.costEquipment) || 0,
    costSubcontractor: Number(v.costSubcontractor) || 0,
    overheadPercentage: Number(v.overheadPercentage) || 0,
    profitPercentage: Number(v.profitPercentage) || 0,
    contingencyPercentage: Number(v.contingencyPercentage) || 0,
    vatPercentage: Number(v.vatPercentage) || 0,
  });
  const currency = v.currency || getSystemCurrency();
  const revised = revisedContractValue(
    Number(v.originalContractValue) || 0,
    (Number(v.approvedChangeOrdersToDate) || 0) + (v.status === "APPROVED" ? breakdown.total : 0),
  );

  async function onSubmit(values: Values) {
    setSaving(true);
    setResult(null);
    const project = projects.find((p) => p.id === values.projectId);
    const payload = { ...values, projectName: project?.name ?? values.projectId };
    try {
      const url =
        mode === "new"
          ? "/api/construction-admin/change-orders"
          : `/api/construction-admin/change-orders/${changeOrderId}`;
      const res = await fetch(url, {
        method: mode === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult({ ok: false, error: json.error ?? `Request failed (${res.status})` });
      } else {
        setResult({ ok: true, co: json.data });
        if (mode === "edit") router.refresh();
      }
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message });
    } finally {
      setSaving(false);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {result?.ok ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-emerald-200 bg-emerald-50 px-5 py-4">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-3.5 w-3.5" />
          </span>
          <div className="text-sm">
            <p className="font-medium text-emerald-800">
              Change order {mode === "new" ? "created" : "updated"} — {result.co?.changeOrderNumber}
            </p>
            <p className="mt-0.5 text-emerald-700">
              Saved to the database via the API.{" "}
              {result.co ? (
                <Link href={`/construction-admin/change-orders/${result.co.id}`} className="font-medium underline">
                  Open change order
                </Link>
              ) : null}
            </p>
          </div>
        </div>
      ) : result?.error ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-medium text-amber-800">Not saved</p>
            <p className="mt-0.5 text-amber-700">{result.error}</p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Change Order" subtitle="Scope, reason and parties" />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Project *</label>
                  <select
                    className={inputCls}
                    {...register("projectId", { required: true })}
                    onChange={(e) => {
                      const p = projects.find((x) => x.id === e.target.value);
                      if (p) setValue("originalContractValue", p.value);
                    }}
                  >
                    <option value="">Select a project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Requested by</label>
                  <input className={inputCls} {...register("requestedBy")} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Title *</label>
                <input className={inputCls} placeholder="e.g. Upgrade lobby flooring" {...register("title", { required: true })} />
              </div>
              <div>
                <label className={labelCls}>Reason</label>
                <input className={inputCls} placeholder="Owner request / design development / site condition" {...register("reason")} />
              </div>
              <div>
                <label className={labelCls}>Scope description</label>
                <textarea className={`${inputCls} h-auto min-h-[80px] py-2`} {...register("description")} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Contractor</label>
                  <input className={inputCls} {...register("contractor")} />
                </div>
                <div>
                  <label className={labelCls}>Owner</label>
                  <input className={inputCls} {...register("owner")} />
                </div>
                <div>
                  <label className={labelCls}>Architect</label>
                  <input className={inputCls} {...register("architect")} />
                </div>
                <div>
                  <label className={labelCls}>Engineer</label>
                  <input className={inputCls} {...register("engineer")} />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Cost Breakdown" subtitle="Direct costs and markups (compounded per spec)" />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {([
                  ["costLabor", "Labor"],
                  ["costMaterial", "Material"],
                  ["costEquipment", "Equipment"],
                  ["costSubcontractor", "Subcontractor"],
                ] as const).map(([name, label]) => (
                  <div key={name}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" step="any" className={`${inputCls} text-right`} {...register(name, { valueAsNumber: true })} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {([
                  ["overheadPercentage", "Overhead %"],
                  ["profitPercentage", "Profit %"],
                  ["contingencyPercentage", "Contingency %"],
                  ["vatPercentage", "VAT %"],
                ] as const).map(([name, label]) => (
                  <div key={name}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" step="any" className={`${inputCls} text-right`} {...register(name, { valueAsNumber: true })} />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Sidebar: live totals + commercial */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Calculated Total" />
            <CardBody className="space-y-2">
              <MoneyLine currency={currency} label="Subtotal" value={breakdown.subtotal} />
              <MoneyLine currency={currency} label="Overhead" value={breakdown.overhead} />
              <MoneyLine currency={currency} label="Profit" value={breakdown.profit} />
              <MoneyLine currency={currency} label="Contingency" value={breakdown.contingency} />
              <MoneyLine currency={currency} label="VAT" value={breakdown.vat} />
              <div className="border-t border-border pt-2">
                <MoneyLine currency={currency} label="Total cost" value={breakdown.total} strong />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contract Impact" />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Status</label>
                  <select className={inputCls} {...register("status")}>
                    {(Object.keys(CHANGE_ORDER_STATUS_LABEL) as ChangeOrderStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {CHANGE_ORDER_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Currency</label>
                  <select className={inputCls} {...register("currency")}>
                    {currencyOptions(OTHER_CURRENCIES).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Original contract value</label>
                <input type="number" step="any" className={`${inputCls} text-right`} {...register("originalContractValue", { valueAsNumber: true })} />
              </div>
              <div>
                <label className={labelCls}>Approved COs to date</label>
                <input type="number" step="any" className={`${inputCls} text-right`} {...register("approvedChangeOrdersToDate", { valueAsNumber: true })} />
              </div>
              <div>
                <label className={labelCls}>Schedule impact (days)</label>
                <input type="number" step="1" className={`${inputCls} text-right`} {...register("scheduleImpactDays", { valueAsNumber: true })} />
              </div>
              <div className="rounded-lg bg-surface-2 p-3">
                <MoneyLine currency={currency} label="Revised contract value" value={revised} strong />
                <p className="mt-1 text-[11px] text-faint">Includes this CO only when status is Approved.</p>
              </div>
            </CardBody>
          </Card>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : mode === "new" ? "Create change order" : "Save changes"}
            </button>
            <Link
              href="/construction-admin/change-orders"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-2"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}
