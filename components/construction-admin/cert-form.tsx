"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, useWatch, Controller } from "react-hook-form";
import { Check, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ProjectSelect } from "@/components/projects/project-select";
import { progressPayment } from "@/lib/ca/calc";
import { CERT_STATUS_LABEL } from "@/lib/ca/labels";
import type { ProgressCertification, CertificationStatus } from "@/lib/ca/types";
import { currencyOptions, formatCurrency, getSystemCurrency } from "@/lib/format";

type ProjectOption = { id: string; name: string; value: number };

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

type Values = {
  projectId: string;
  inspectionDate: string;
  certifiedBy: string;
  lenderName: string;
  contractorName: string;
  contractValue: number;
  currency: string;
  previousPercentComplete: number;
  currentPercentComplete: number;
  retentionPercentage: number;
  previousPaymentsValue: number;
  deficiencies: string;
  recommendation: string;
  status: CertificationStatus;
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

export function CertForm({ projects: projectProp, initial, certId }: { projects: ProjectOption[]; initial?: ProgressCertification; certId?: string }) {
  const editing = !!certId;
  // Grown when a project is created from the picker below; `projects.find` in
  // the submit handler must read this, not the prop.
  const [projects, setProjects] = useState(projectProp);
  const [result, setResult] = useState<{ ok: boolean; cert?: ProgressCertification; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, control, setValue } = useForm<Values>({
    defaultValues: initial
      ? {
          projectId: initial.projectId,
          inspectionDate: initial.inspectionDate ?? "",
          certifiedBy: initial.certifiedBy ?? "",
          lenderName: initial.lenderName ?? "",
          contractorName: initial.contractorName ?? "",
          contractValue: initial.contractValue,
          currency: initial.currency,
          previousPercentComplete: initial.previousPercentComplete,
          currentPercentComplete: initial.currentPercentComplete,
          retentionPercentage: initial.retentionPercentage,
          previousPaymentsValue: initial.previousPaymentsValue,
          deficiencies: initial.deficiencies ?? "",
          recommendation: initial.recommendation ?? "",
          status: initial.status,
        }
      : ({ currency: getSystemCurrency(), retentionPercentage: 10, status: "DRAFT" } as Values),
  });

  const v = useWatch({ control });
  const calc = progressPayment({
    contractValue: Number(v.contractValue) || 0,
    currentPercentComplete: Number(v.currentPercentComplete) || 0,
    retentionPercentage: Number(v.retentionPercentage) || 0,
    previousPaymentsValue: Number(v.previousPaymentsValue) || 0,
  });
  const currency = v.currency || getSystemCurrency();

  async function onSubmit(values: Values) {
    setSaving(true);
    setResult(null);
    const project = projects.find((p) => p.id === values.projectId);
    try {
      const res = await fetch(
        editing ? `/api/construction-admin/certifications/${certId}` : "/api/construction-admin/certifications",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...values, projectName: project?.name ?? values.projectId }),
        },
      );
      const json = await res.json();
      if (!res.ok) setResult({ ok: false, error: json.error ?? `Request failed (${res.status})` });
      else setResult({ ok: true, cert: json.data });
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
          <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3.5 w-3.5" /></span>
          <p className="text-sm text-emerald-800">
            Certification {result.cert?.certificationNumber} {editing ? "updated" : "created"}.{" "}
            {result.cert ? <Link href={`/construction-admin/certifications/${result.cert.id}`} className="font-medium underline">Open certification</Link> : null}
          </p>
        </div>
      ) : result?.error ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <p className="text-sm text-amber-800">{result.error}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Progress Certification" subtitle="Voortgangsverklaring — lender/owner draw certification" />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Was a required select over a list that is empty on a fresh
                    install, with no error text — the submit button simply did
                    nothing. Now creatable. Selecting a project still seeds the
                    contract value; a project created here has none yet, so that
                    stays at whatever the user typed. */}
                <Controller
                  control={control}
                  name="projectId"
                  rules={{ required: true }}
                  render={({ field }) => (
                    <ProjectSelect
                      label="Project *"
                      projects={projects}
                      value={field.value ?? ""}
                      onChange={(next) => {
                        field.onChange(next);
                        const p = projects.find((x) => x.id === next);
                        if (p) setValue("contractValue", p.value);
                      }}
                      onCreated={(p) =>
                        setProjects((prev) => [...prev, { id: p.id, name: p.projectName, value: 0 }])
                      }
                      labelClassName={labelCls}
                    />
                  )}
                />
                <div>
                  <label className={labelCls}>Inspection date</label>
                  <input type="date" className={inputCls} {...register("inspectionDate")} />
                </div>
                <div>
                  <label className={labelCls}>Certified by</label>
                  <input className={inputCls} {...register("certifiedBy")} />
                </div>
                <div>
                  <label className={labelCls}>Lender / bank</label>
                  <input className={inputCls} {...register("lenderName")} />
                </div>
                <div>
                  <label className={labelCls}>Contractor</label>
                  <input className={inputCls} {...register("contractorName")} />
                </div>
                <div>
                  <label className={labelCls}>Currency</label>
                  <select className={inputCls} {...register("currency")}>
                    {currencyOptions(OTHER_CURRENCIES).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Valuation" />
            <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <label className={labelCls}>Contract value</label>
                <input type="number" step="any" className={`${inputCls} text-right`} {...register("contractValue", { valueAsNumber: true })} />
              </div>
              <div>
                <label className={labelCls}>Previous %</label>
                <input type="number" step="any" className={`${inputCls} text-right`} {...register("previousPercentComplete", { valueAsNumber: true })} />
              </div>
              <div>
                <label className={labelCls}>Current %</label>
                <input type="number" step="any" className={`${inputCls} text-right`} {...register("currentPercentComplete", { valueAsNumber: true })} />
              </div>
              <div>
                <label className={labelCls}>Retention %</label>
                <input type="number" step="any" className={`${inputCls} text-right`} {...register("retentionPercentage", { valueAsNumber: true })} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Previous payments</label>
                <input type="number" step="any" className={`${inputCls} text-right`} {...register("previousPaymentsValue", { valueAsNumber: true })} />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Findings" />
            <CardBody className="space-y-4">
              <div>
                <label className={labelCls}>Deficiencies</label>
                <textarea className={`${inputCls} h-auto min-h-[72px] py-2`} {...register("deficiencies")} />
              </div>
              <div>
                <label className={labelCls}>Recommendation</label>
                <textarea className={`${inputCls} h-auto min-h-[72px] py-2`} {...register("recommendation")} />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Payment Calculation" />
            <CardBody className="space-y-2">
              <MoneyLine currency={currency} label="Work completed value" value={calc.workCompletedValue} />
              <MoneyLine currency={currency} label="Retention" value={calc.retentionAmount} />
              <div className="border-t border-border pt-2">
                <MoneyLine currency={currency} label="Recommended payment" value={calc.amountRecommendedForPayment} strong />
              </div>
              <p className="pt-1 text-[11px] text-faint">Work completed × %, less retention and previous payments.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Status" />
            <CardBody>
              <select className={inputCls} {...register("status")}>
                {(Object.keys(CERT_STATUS_LABEL) as CertificationStatus[]).map((s) => (
                  <option key={s} value={s}>{CERT_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </CardBody>
          </Card>

          <div className="flex items-center gap-2">
            <button type="submit" disabled={saving} className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50">
              {saving ? "Saving…" : editing ? "Save changes" : "Create certification"}
            </button>
            <Link href="/construction-admin/certifications" className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-2">
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}
