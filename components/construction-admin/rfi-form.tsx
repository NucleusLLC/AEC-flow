"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Check, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { DISCIPLINE_LABEL, RFI_PRIORITY_LABEL } from "@/lib/ca/labels";
import type { Rfi, CaDiscipline, RfiPriority } from "@/lib/ca/types";

type ProjectOption = { id: string; name: string };

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

type Values = {
  projectId: string;
  subject: string;
  question: string;
  submittedBy: string;
  assignedTo: string;
  discipline: CaDiscipline;
  priority: RfiPriority;
  dateRequired: string;
};

export function RfiForm({ projects }: { projects: ProjectOption[] }) {
  const [result, setResult] = useState<{ ok: boolean; rfi?: Rfi; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit } = useForm<Values>({
    defaultValues: { discipline: "ARCHITECTURAL", priority: "NORMAL" } as Values,
  });

  async function onSubmit(values: Values) {
    setSaving(true);
    setResult(null);
    const project = projects.find((p) => p.id === values.projectId);
    try {
      const res = await fetch("/api/construction-admin/rfis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, projectName: project?.name ?? values.projectId }),
      });
      const json = await res.json();
      if (!res.ok) setResult({ ok: false, error: json.error ?? `Request failed (${res.status})` });
      else setResult({ ok: true, rfi: json.data });
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
            RFI {result.rfi?.rfiNumber} created.{" "}
            {result.rfi ? <Link href={`/construction-admin/rfis/${result.rfi.id}`} className="font-medium underline">Open RFI</Link> : null}
          </p>
        </div>
      ) : result?.error ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <p className="text-sm text-amber-800">{result.error}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader title="Request for Information" />
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
              <label className={labelCls}>Submitted by</label>
              <input className={inputCls} {...register("submittedBy")} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Subject *</label>
            <input className={inputCls} placeholder="Short subject of the query" {...register("subject", { required: true })} />
          </div>
          <div>
            <label className={labelCls}>Question</label>
            <textarea className={`${inputCls} h-auto min-h-[100px] py-2`} placeholder="Describe the information or clarification required…" {...register("question")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className={labelCls}>Discipline</label>
              <select className={inputCls} {...register("discipline")}>
                {(Object.keys(DISCIPLINE_LABEL) as CaDiscipline[]).map((d) => (
                  <option key={d} value={d}>{DISCIPLINE_LABEL[d]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select className={inputCls} {...register("priority")}>
                {(Object.keys(RFI_PRIORITY_LABEL) as RfiPriority[]).map((p) => (
                  <option key={p} value={p}>{RFI_PRIORITY_LABEL[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Assigned to</label>
              <input className={inputCls} {...register("assignedTo")} />
            </div>
            <div>
              <label className={labelCls}>Response required by</label>
              <input type="date" className={inputCls} {...register("dateRequired")} />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50">
          {saving ? "Saving…" : "Submit RFI"}
        </button>
        <Link href="/construction-admin/rfis" className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-2">
          Cancel
        </Link>
      </div>
    </form>
  );
}
