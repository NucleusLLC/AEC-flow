"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  DISCIPLINE_LABEL,
  PROJECT_STATUS_LABEL,
  PRIORITY_LABEL,
  type Discipline,
  type ProjectStatus,
  type Priority,
  type ProjectWriteInput,
} from "@/lib/data/projects.types";
import { saveProject } from "@/app/(app)/projects/actions";
import { getSystemCurrency } from "@/lib/format";

const inputClass =
  "h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15";
const labelClass = "mb-1 block text-xs font-medium text-muted";

const DISCIPLINES = Object.keys(DISCIPLINE_LABEL) as Discipline[];
const STATUSES = Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[];
const PRIORITIES = Object.keys(PRIORITY_LABEL) as Priority[];

/**
 * Prefill shape for edit mode. `clientName`/`manager` are display names (the
 * form submits names; they're resolved to ids server-side). Empty strings /
 * empty arrays render as "unset" for the uncontrolled inputs.
 */
export type ProjectFormValues = {
  name: string;
  clientName: string;
  manager: string;
  status: ProjectStatus;
  priority: Priority;
  disciplines: Discipline[];
  startDate: string;
  targetEndDate: string;
  value: number;
  siteAddress: string;
  description: string;
  currency: string;
};

export function ProjectForm({
  clients,
  managers,
  mode = "new",
  initial,
  projectId,
  backHref = "/projects",
}: {
  clients: string[];
  managers: string[];
  mode?: "new" | "edit";
  initial?: ProjectFormValues;
  projectId?: string;
  backHref?: string;
}) {
  const router = useRouter();
  const [submitting, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: ProjectWriteInput = {
      name: String(fd.get("name") ?? ""),
      clientName: String(fd.get("clientName") ?? ""),
      manager: String(fd.get("manager") ?? ""),
      status: (fd.get("status") as ProjectStatus) || undefined,
      priority: (fd.get("priority") as Priority) || undefined,
      disciplines: fd.getAll("disciplines").map((d) => String(d) as Discipline),
      startDate: (fd.get("startDate") as string) || null,
      targetEndDate: (fd.get("targetEndDate") as string) || null,
      value: Number(fd.get("value")) || 0,
      siteAddress: (fd.get("siteAddress") as string) || null,
      description: (fd.get("description") as string) || null,
      currency: (fd.get("currency") as string) || undefined,
    };

    setError(null);
    startTransition(async () => {
      const res =
        mode === "edit"
          ? await saveProject("edit", payload, projectId)
          : await saveProject("new", payload);
      if (res.ok) {
        router.push(`/projects/${res.id}`);
        router.refresh();
      } else {
        setError(res.error);
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-red-200 bg-red-50 px-5 py-4">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-red-800">
              Could not {mode === "edit" ? "update" : "create"} project.
            </p>
            <p className="mt-0.5 text-red-700">{error}</p>
          </div>
        </div>
      ) : null}

      {mode === "edit" ? (
        <input type="hidden" name="currency" defaultValue={initial?.currency ?? getSystemCurrency()} />
      ) : null}

      <div className="card-surface rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <h3 className="mb-4 text-sm font-semibold text-fg">Project details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="name">
              Project name *
            </label>
            <input id="name" name="name" required className={inputClass} placeholder="e.g. Marina Heights Tower — Phase 3" defaultValue={initial?.name} />
          </div>

          <div>
            <label className={labelClass} htmlFor="clientName">
              Client
            </label>
            <select id="clientName" name="clientName" className={inputClass} defaultValue={initial?.clientName ?? clients[0] ?? ""}>
              {clients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="manager">
              Project manager
            </label>
            <select id="manager" name="manager" className={inputClass} defaultValue={initial?.manager ?? managers[0] ?? ""}>
              {managers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="status">
              Status
            </label>
            <select id="status" name="status" className={inputClass} defaultValue={initial?.status ?? "ACTIVE"}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PROJECT_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="priority">
              Priority
            </label>
            <select id="priority" name="priority" className={inputClass} defaultValue={initial?.priority ?? "MEDIUM"}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass} htmlFor="startDate">
              Start date
            </label>
            <input id="startDate" name="startDate" type="date" className={inputClass} defaultValue={initial?.startDate} />
          </div>

          <div>
            <label className={labelClass} htmlFor="targetEndDate">
              Target end date
            </label>
            <input id="targetEndDate" name="targetEndDate" type="date" className={inputClass} defaultValue={initial?.targetEndDate} />
          </div>

          <div>
            <label className={labelClass} htmlFor="value">
              Contract value ({getSystemCurrency()})
            </label>
            <input id="value" name="value" type="number" min="0" step="1000" className={inputClass} placeholder="0" defaultValue={initial?.value ? initial.value : undefined} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="siteAddress">
              Site address
            </label>
            <input id="siteAddress" name="siteAddress" className={inputClass} placeholder="e.g. Dubai Marina, Plot D2, Dubai" defaultValue={initial?.siteAddress} />
          </div>

          <div className="sm:col-span-2">
            <span className={labelClass}>Disciplines</span>
            <div className="flex flex-wrap gap-3">
              {DISCIPLINES.map((d) => (
                <label key={d} className="inline-flex items-center gap-2 text-sm text-fg">
                  <input type="checkbox" name="disciplines" value={d} defaultChecked={initial?.disciplines.includes(d)} className="h-4 w-4 rounded border-border text-brand focus:ring-brand/30" />
                  {DISCIPLINE_LABEL[d]}
                </label>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-brand focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand/15"
              placeholder="Scope summary, key requirements…"
              defaultValue={initial?.description}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Link
          href={backHref}
          className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Saving…" : mode === "edit" ? "Save changes" : "Create project"}
        </button>
      </div>
    </form>
  );
}
