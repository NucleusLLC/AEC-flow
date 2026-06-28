"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, useFieldArray, type UseFormRegister } from "react-hook-form";
import { Check, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { CA_REPORT_TYPE_LABEL } from "@/lib/ca/labels";
import type { CaReport, CaReportType } from "@/lib/ca/types";

type ProjectOption = { id: string; name: string };

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

type Values = {
  projectId: string;
  reportType: CaReportType;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  preparedBy: string;
  weatherSummary: string;
  siteConditions: string;
  workCompleted: string;
  workPlannedNextPeriod: string;
  manpowerSummary: { trade: string; count: number; hours: number }[];
  materialDeliveries: string;
  safetyIncidents: string;
  qualityIssues: string;
  delays: string;
  risks: string;
  notes: string;
};

const REPORT_TYPES: CaReportType[] = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY", "EXECUTIVE"];

function TextField({
  name,
  label,
  area,
  register,
}: {
  name: keyof Values;
  label: string;
  area?: boolean;
  register: UseFormRegister<Values>;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {area ? (
        <textarea className={`${inputCls} h-auto min-h-[72px] py-2`} {...register(name)} />
      ) : (
        <input className={inputCls} {...register(name)} />
      )}
    </div>
  );
}

export function ReportForm({
  projects,
  defaultType = "WEEKLY",
}: {
  projects: ProjectOption[];
  defaultType?: CaReportType;
}) {
  const [result, setResult] = useState<{ ok: boolean; report?: CaReport; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, control } = useForm<Values>({
    defaultValues: {
      reportType: defaultType,
      manpowerSummary: [{ trade: "", count: 0, hours: 0 }],
    } as Values,
  });
  const manpower = useFieldArray({ control, name: "manpowerSummary" });

  async function onSubmit(values: Values) {
    setSaving(true);
    setResult(null);
    const project = projects.find((p) => p.id === values.projectId);
    try {
      const res = await fetch("/api/construction-admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          projectName: project?.name ?? values.projectId,
          manpowerSummary: values.manpowerSummary
            .filter((m) => m.trade)
            .map((m) => ({ trade: m.trade, count: Number(m.count) || 0, hours: Number(m.hours) || 0 })),
        }),
      });
      const json = await res.json();
      if (!res.ok) setResult({ ok: false, error: json.error ?? `Request failed (${res.status})` });
      else setResult({ ok: true, report: json.data });
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
            {result.report ? CA_REPORT_TYPE_LABEL[result.report.reportType] : "Report"} {result.report?.reportNumber} created.{" "}
            {result.report ? <Link href={`/construction-admin/reports/${result.report.id}`} className="font-medium underline">Open report</Link> : null}
          </p>
        </div>
      ) : result?.error ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <p className="text-sm text-amber-800">{result.error}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader title="Report Header" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Project *</label>
              <select className={inputCls} {...register("projectId", { required: true })}>
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Report type</label>
              <select className={inputCls} {...register("reportType")}>
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>{CA_REPORT_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Period start</label>
              <input type="date" className={inputCls} {...register("reportingPeriodStart")} />
            </div>
            <div>
              <label className={labelCls}>Period end</label>
              <input type="date" className={inputCls} {...register("reportingPeriodEnd")} />
            </div>
            <TextField register={register} name="preparedBy" label="Prepared by" />
            <TextField register={register} name="weatherSummary" label="Weather" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Progress" />
        <CardBody className="space-y-4">
          <TextField register={register} name="workCompleted" label="Work completed" area />
          <TextField register={register} name="workPlannedNextPeriod" label="Work planned next period" area />
          <TextField register={register} name="siteConditions" label="Site conditions" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Manpower"
          action={
            <button type="button" onClick={() => manpower.append({ trade: "", count: 0, hours: 0 })} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-fg hover:bg-surface-2">
              <Plus className="h-3.5 w-3.5" />
              Add trade
            </button>
          }
        />
        <CardBody className="space-y-2">
          {manpower.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-12 items-center gap-2">
              <input className={`${inputCls} col-span-7`} placeholder="Trade / contractor" {...register(`manpowerSummary.${i}.trade` as const)} />
              <input type="number" className={`${inputCls} col-span-2 text-right`} placeholder="No." {...register(`manpowerSummary.${i}.count` as const, { valueAsNumber: true })} />
              <input type="number" className={`${inputCls} col-span-2 text-right`} placeholder="Hrs" {...register(`manpowerSummary.${i}.hours` as const, { valueAsNumber: true })} />
              <button type="button" onClick={() => manpower.remove(i)} disabled={manpower.fields.length === 1} className="col-span-1 inline-flex h-9 items-center justify-center rounded-lg text-faint hover:text-red-600 disabled:opacity-30" aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Events, Quality &amp; Risk" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField register={register} name="materialDeliveries" label="Material deliveries" area />
          <TextField register={register} name="safetyIncidents" label="Safety incidents" area />
          <TextField register={register} name="qualityIssues" label="Quality issues" area />
          <TextField register={register} name="delays" label="Delays" area />
          <TextField register={register} name="risks" label="Risks" area />
          <TextField register={register} name="notes" label="Notes" area />
        </CardBody>
      </Card>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50">
          {saving ? "Saving…" : "Generate report"}
        </button>
        <Link href="/construction-admin/reports" className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-2">
          Cancel
        </Link>
      </div>
    </form>
  );
}
