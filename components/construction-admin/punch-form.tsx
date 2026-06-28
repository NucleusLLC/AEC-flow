"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Check, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import type { PunchListItem, PunchPriority } from "@/lib/ca/types";

type ProjectOption = { id: string; name: string };

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

const PRIORITY_LABEL: Record<PunchPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

type Values = {
  projectId: string;
  description: string;
  location: string;
  trade: string;
  responsibleParty: string;
  priority: PunchPriority;
  dueDate: string;
  notes: string;
};

export function PunchForm({ projects }: { projects: ProjectOption[] }) {
  const [result, setResult] = useState<{ ok: boolean; item?: PunchListItem; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit } = useForm<Values>({
    defaultValues: { priority: "MEDIUM" } as Values,
  });

  async function onSubmit(values: Values) {
    setSaving(true);
    setResult(null);
    const project = projects.find((p) => p.id === values.projectId);
    try {
      const res = await fetch("/api/construction-admin/punch-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, projectName: project?.name ?? values.projectId }),
      });
      const json = await res.json();
      if (!res.ok) setResult({ ok: false, error: json.error ?? `Request failed (${res.status})` });
      else setResult({ ok: true, item: json.data });
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
            Punch item {result.item?.itemNumber} created.{" "}
            {result.item ? <Link href={`/construction-admin/punch-list/${result.item.id}`} className="font-medium underline">Open item</Link> : null}
          </p>
        </div>
      ) : result?.error ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <p className="text-sm text-amber-800">{result.error}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader title="Punch List Item" />
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
              <label className={labelCls}>Location</label>
              <input className={inputCls} placeholder="e.g. Level 8 — Unit 0804" {...register("location")} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description *</label>
            <textarea className={`${inputCls} h-auto min-h-[90px] py-2`} placeholder="Describe the defect or outstanding work…" {...register("description", { required: true })} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className={labelCls}>Trade</label>
              <input className={inputCls} placeholder="e.g. Plumbing" {...register("trade")} />
            </div>
            <div>
              <label className={labelCls}>Responsible party</label>
              <input className={inputCls} placeholder="Contractor / subcontractor" {...register("responsibleParty")} />
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select className={inputCls} {...register("priority")}>
                {(Object.keys(PRIORITY_LABEL) as PunchPriority[]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Due date</label>
              <input type="date" className={inputCls} {...register("dueDate")} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={`${inputCls} h-auto min-h-[70px] py-2`} {...register("notes")} />
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50">
          {saving ? "Saving…" : "Add punch item"}
        </button>
        <Link href="/construction-admin/punch-list" className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-2">
          Cancel
        </Link>
      </div>
    </form>
  );
}
