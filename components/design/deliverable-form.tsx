"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ProjectSelect } from "@/components/projects/project-select";
import {
  DISCIPLINES,
  DISCIPLINE_LABEL,
  DELIVERABLE_TYPES,
  DELIVERABLE_TYPE_LABEL,
  DELIVERABLE_STATUSES,
  DELIVERABLE_STATUS_LABEL,
  type DesignDeliverableDTO,
  type DesignDeliverableInput,
  type DesignDiscipline,
  type DeliverableStatus,
  type DeliverableType,
} from "@/lib/design/types";
import {
  createDeliverableAction,
  updateDeliverableAction,
} from "@/app/(app)/design/actions";

type Option = { id: string; name: string };

const field =
  "h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const label = "mb-1 block text-xs font-medium text-muted";

export function DeliverableForm({
  projects: projectProp,
  mode,
  initial,
  defaultDiscipline,
}: {
  projects: Option[];
  mode: "new" | "edit";
  initial?: DesignDeliverableDTO;
  defaultDiscipline?: DesignDiscipline;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Grown when a project is created from the picker.
  const [projects, setProjects] = useState(projectProp);

  const [number, setNumber] = useState(initial?.number ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [discipline, setDiscipline] = useState<DesignDiscipline>(
    initial?.discipline ?? defaultDiscipline ?? "ARCHITECTURE",
  );
  const [type, setType] = useState<DeliverableType>(initial?.type ?? "DRAWING");
  const [revision, setRevision] = useState(initial?.revision ?? "-");
  const [status, setStatus] = useState<DeliverableStatus>(initial?.status ?? "DRAFT");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [scale, setScale] = useState(initial?.scale ?? "");
  const [sheetSize, setSheetSize] = useState(initial?.sheetSize ?? "");
  const [issuedTo, setIssuedTo] = useState(initial?.issuedTo ?? "");
  const [issuedDate, setIssuedDate] = useState(initial?.issuedDate ?? "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [fileLink, setFileLink] = useState(initial?.fileLink ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const project = projects.find((p) => p.id === projectId);
    const input: DesignDeliverableInput = {
      number,
      title,
      discipline,
      type,
      revision,
      status,
      projectId: projectId || null,
      projectName: project?.name ?? null,
      scale: scale || null,
      sheetSize: sheetSize || null,
      issuedTo: issuedTo || null,
      issuedDate: issuedDate || null,
      dueDate: dueDate || null,
      fileLink: fileLink || null,
      notes: notes || null,
    };
    start(async () => {
      const res =
        mode === "edit" && initial
          ? await updateDeliverableAction(initial.id, input)
          : await createDeliverableAction(input);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/design/deliverable/${res.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader title="Deliverable" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Number *</label>
            <input value={number} onChange={(e) => setNumber(e.target.value)} className={`${field} font-mono`} placeholder="A-101" />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="Ground floor plan" />
          </div>
          <div>
            <label className={label}>Discipline</label>
            <select value={discipline} onChange={(e) => setDiscipline(e.target.value as DesignDiscipline)} className={field}>
              {DISCIPLINES.map((d) => (
                <option key={d} value={d}>{DISCIPLINE_LABEL[d]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as DeliverableType)} className={field}>
              {DELIVERABLE_TYPES.map((t) => (
                <option key={t} value={t}>{DELIVERABLE_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Revision</label>
            <input value={revision} onChange={(e) => setRevision(e.target.value)} className={field} placeholder="A / P1 / C1" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Issue & status" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as DeliverableStatus)} className={field}>
              {DELIVERABLE_STATUSES.map((s) => (
                <option key={s} value={s}>{DELIVERABLE_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
          {/* Optional — a deliverable need not belong to a project — so "— None —"
              stays a real choice. It is still creatable: wanting to file this
              against a project that does not exist yet is the common case, and
              leaving is the only thing the old select allowed. */}
          <ProjectSelect
            label="Project"
            projects={projects}
            value={projectId}
            onChange={setProjectId}
            onCreated={(p) => setProjects((prev) => [...prev, { id: p.id, name: p.projectName }])}
            allowEmpty
            placeholder="— None —"
          />
          <div>
            <label className={label}>Issued to</label>
            <input value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} className={field} placeholder="Contractor / client" />
          </div>
          <div>
            <label className={label}>Issued date</label>
            <input type="date" value={issuedDate} onChange={(e) => setIssuedDate(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Due date</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={field} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Sheet & file" />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Scale</label>
            <input value={scale} onChange={(e) => setScale(e.target.value)} className={field} placeholder="1:100" />
          </div>
          <div>
            <label className={label}>Sheet size</label>
            <input value={sheetSize} onChange={(e) => setSheetSize(e.target.value)} className={field} placeholder="A1" />
          </div>
          <div>
            <label className={label}>File link</label>
            <input value={fileLink} onChange={(e) => setFileLink(e.target.value)} className={field} placeholder="https://…" />
          </div>
          <div className="sm:col-span-3">
            <label className={label}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${field} h-auto py-2`} />
          </div>
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
          {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Add deliverable"}
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
