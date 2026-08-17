"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { Check, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ProjectSelect } from "@/components/projects/project-select";
import { DISCIPLINE_LABEL, IMPACT_LEVEL_LABEL, SITE_INSTRUCTION_STATUS_LABEL } from "@/lib/ca/labels";
import type { SiteInstruction, CaDiscipline, ImpactLevel, SiteInstructionStatus } from "@/lib/ca/types";

type ProjectOption = { id: string; name: string };

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelCls = "mb-1 block text-xs font-medium text-muted";

type Values = {
  projectId: string;
  title: string;
  description: string;
  issuedBy: string;
  issuedTo: string;
  discipline: CaDiscipline;
  costImpact: ImpactLevel;
  scheduleImpact: ImpactLevel;
  status: SiteInstructionStatus;
};

export function SiteInstructionForm({ projects: projectProp }: { projects: ProjectOption[] }) {
  // Grown when a project is created from the picker below; `projects.find` in
  // the submit handler must read this, not the prop.
  const [projects, setProjects] = useState(projectProp);
  const [result, setResult] = useState<{ ok: boolean; si?: SiteInstruction; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, control } = useForm<Values>({
    defaultValues: { discipline: "ARCHITECTURAL", costImpact: "NONE", scheduleImpact: "NONE", status: "DRAFT" } as Values,
  });

  async function onSubmit(values: Values) {
    setSaving(true);
    setResult(null);
    const project = projects.find((p) => p.id === values.projectId);
    try {
      const res = await fetch("/api/construction-admin/site-instructions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, projectName: project?.name ?? values.projectId }),
      });
      const json = await res.json();
      if (!res.ok) setResult({ ok: false, error: json.error ?? `Request failed (${res.status})` });
      else setResult({ ok: true, si: json.data });
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
            Site instruction {result.si?.instructionNumber} created.{" "}
            {result.si ? <Link href={`/construction-admin/site-instructions/${result.si.id}`} className="font-medium underline">Open instruction</Link> : null}
          </p>
        </div>
      ) : result?.error ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
          <p className="text-sm text-amber-800">{result.error}</p>
        </div>
      ) : null}

      <Card>
        <CardHeader title="Site Instruction" />
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
              <label className={labelCls}>Status</label>
              <select className={inputCls} {...register("status")}>
                {(Object.keys(SITE_INSTRUCTION_STATUS_LABEL) as SiteInstructionStatus[]).map((s) => (
                  <option key={s} value={s}>{SITE_INSTRUCTION_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Title *</label>
            <input className={inputCls} placeholder="Instruction summary" {...register("title", { required: true })} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} h-auto min-h-[100px] py-2`} placeholder="What the contractor is instructed to do…" {...register("description")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Issued by</label>
              <input className={inputCls} placeholder="Consultant / engineer" {...register("issuedBy")} />
            </div>
            <div>
              <label className={labelCls}>Issued to</label>
              <input className={inputCls} placeholder="Contractor" {...register("issuedTo")} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Discipline</label>
              <select className={inputCls} {...register("discipline")}>
                {(Object.keys(DISCIPLINE_LABEL) as CaDiscipline[]).map((d) => (
                  <option key={d} value={d}>{DISCIPLINE_LABEL[d]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Cost impact</label>
              <select className={inputCls} {...register("costImpact")}>
                {(Object.keys(IMPACT_LEVEL_LABEL) as ImpactLevel[]).map((l) => (
                  <option key={l} value={l}>{IMPACT_LEVEL_LABEL[l]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Schedule impact</label>
              <select className={inputCls} {...register("scheduleImpact")}>
                {(Object.keys(IMPACT_LEVEL_LABEL) as ImpactLevel[]).map((l) => (
                  <option key={l} value={l}>{IMPACT_LEVEL_LABEL[l]}</option>
                ))}
              </select>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center gap-2">
        <button type="submit" disabled={saving} className="inline-flex h-10 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50">
          {saving ? "Saving…" : "Create instruction"}
        </button>
        <Link href="/construction-admin/site-instructions" className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-2">
          Cancel
        </Link>
      </div>
    </form>
  );
}
