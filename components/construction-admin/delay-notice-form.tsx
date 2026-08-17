"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { Check, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ProjectSelect } from "@/components/projects/project-select";
import type { DelayNotice } from "@/lib/ca/types";
import { getSystemCurrency } from "@/lib/format";

type ProjectOption = { id: string; name: string };

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

type Values = {
  projectId: string;
  title: string;
  description: string;
  cause: string;
  responsibleParty: string;
  claimedDays: number;
  costImpact: number;
  dateStarted: string;
};

export function DelayNoticeForm({ projects: projectProp }: { projects: ProjectOption[] }) {
  // Grown when a project is created from the picker below; `projects.find` in
  // the submit handler must read this, not the prop.
  const [projects, setProjects] = useState(projectProp);
  const [result, setResult] = useState<{ ok: boolean; dn?: DelayNotice; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, control } = useForm<Values>({
    defaultValues: { claimedDays: 0, costImpact: 0 } as Values,
  });

  async function onSubmit(values: Values) {
    setSaving(true);
    setResult(null);
    const project = projects.find((p) => p.id === values.projectId);
    try {
      const res = await fetch("/api/construction-admin/delay-notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, projectName: project?.name ?? values.projectId }),
      });
      const json = await res.json();
      if (!res.ok) setResult({ ok: false, error: json.error ?? `Request failed (${res.status})` });
      else setResult({ ok: true, dn: json.data });
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
            Delay notice {result.dn?.delayNoticeNumber} created.{" "}
            {result.dn ? <Link href={`/construction-admin/delay-notices/${result.dn.id}`} className="font-medium underline">Open notice</Link> : null}
          </p>
        </div>
      ) : result?.error ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <p className="text-sm text-amber-800">{result.error}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader title="Delay Notice" />
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Was a required select over a list that is empty on a fresh
                install: "Select a project…" with nothing to select and no error
                text, so the submit button simply did nothing. Now creatable. */}
            <Controller
              control={control}
              name="projectId"
              rules={{ required: true }}
              render={({ field }) => (
                <ProjectSelect
                  label="Project *"
                  projects={projects}
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  // No projectNumber: these pages only ever mapped id+name out
                  // of getProjects(), so adding it here would label the new row
                  // differently from every other row.
                  onCreated={(p) => setProjects((prev) => [...prev, { id: p.id, name: p.projectName }])}
                  labelClassName={labelCls}
                />
              )}
            />
            <div>
              <label className={labelCls}>Responsible party</label>
              <input className={inputCls} placeholder="Who is responsible for the delay" {...register("responsibleParty")} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Title *</label>
            <input className={inputCls} placeholder="e.g. Façade bracket delivery delay" {...register("title", { required: true })} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} h-auto min-h-[90px] py-2`} placeholder="What was delayed and the effect on the works…" {...register("description")} />
          </div>
          <div>
            <label className={labelCls}>Cause</label>
            <input className={inputCls} placeholder="Root cause" {...register("cause")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Claimed days</label>
              <input type="number" min={0} className={inputCls} {...register("claimedDays", { valueAsNumber: true })} />
            </div>
            <div>
              <label className={labelCls}>Cost impact ({getSystemCurrency()})</label>
              <input type="number" min={0} step="0.01" className={inputCls} {...register("costImpact", { valueAsNumber: true })} />
            </div>
            <div>
              <label className={labelCls}>Delay started</label>
              <input type="date" className={inputCls} {...register("dateStarted")} />
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50">
          {saving ? "Saving…" : "Create delay notice"}
        </button>
        <Link href="/construction-admin/delay-notices" className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-2">
          Cancel
        </Link>
      </div>
    </form>
  );
}
