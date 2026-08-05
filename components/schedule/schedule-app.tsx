"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, FolderPlus, Printer } from "lucide-react";
import { ProjectPicker, ProjectCrumb, type ProjectPickerRow } from "@/components/projects/project-picker";
import { EmailButton } from "@/components/email/email-button";
import { NewProjectPanel, type CreatedProject } from "@/components/projects/new-project-panel";
import { ScheduleGantt } from "./schedule-gantt";
import type { ProjectSchedule } from "@/lib/data/schedule";

/** A project that can be scheduled, whether or not it has a programme yet. */
export type SchedulableProject = {
  /**
   * Project row id. A saved `ProjectSchedule.projectId` holds THIS, not the
   * project number — only the in-code demo seeds are keyed by number. So a new
   * programme must be keyed by id too, or the same project would end up with
   * two schedules.
   */
  id: string;
  projectNumber: string;
  projectName: string;
  client: string;
};

export function ScheduleApp({
  schedules,
  directory,
  projects = [],
  clients = [],
  initialProjectId,
}: {
  schedules: ProjectSchedule[];
  directory: Record<string, { location: string; client: string }>;
  /**
   * Every project in the practice. Projects with no saved programme are listed
   * too — otherwise "New Schedule" could only offer projects that already had
   * one, which is the opposite of what it is for.
   */
  projects?: SchedulableProject[];
  /** Clients a project created inline can be filed under. */
  clients?: { id: string; name: string }[];
  /**
   * Programme to open on arrival — `/schedule?project=<id>`. Same contract as
   * `/estimates?project=<id>`. An id nothing matches is simply ignored (see the
   * `row` guard below), so a stale or hand-typed link still lands on the picker.
   */
  initialProjectId?: string;
}) {
  // PROTECTED SYSTEM — navigation change, approved 2026-08-04.
  //
  // Seeded from the URL rather than adopted in an effect, so the programme is in
  // the FIRST render — server and client agree and there is no flash of the
  // picker on a deep link. With no param this is `null`, byte-for-byte the
  // behaviour every existing entry into /schedule has always had.
  const [sel, setSel] = useState<string | null>(initialProjectId ?? null);
  const [newOpen, setNewOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  // Projects created inline: saveProject revalidates /projects, not /schedule,
  // so this page's `projects` prop does not include them until a reload.
  const [added, setAdded] = useState<CreatedProject[]>([]);

  /** Rows for projects that already have a programme (persisted or seeded). */
  const scheduledRows: ProjectPickerRow[] = useMemo(
    () =>
      schedules.map((s) => ({
        key: s.projectId,
        projectNumber: s.projectNumber,
        projectName: s.projectName,
        location: directory[s.projectNumber]?.location ?? "—",
        client: s.client || directory[s.projectNumber]?.client || "—",
        count: s.tasks.length,
      })),
    [schedules, directory],
  );

  /**
   * Rows for projects with no programme yet — the ones users came looking for.
   *
   * A project counts as scheduled when a schedule is keyed by EITHER its row id
   * (what the app writes) or its project number (what the in-code demo seeds
   * use). Checking only one of the two listed already-scheduled projects a
   * second time, and starting a programme from that row would have written a
   * duplicate schedule for the same project.
   */
  const unscheduledRows: ProjectPickerRow[] = useMemo(() => {
    const scheduled = new Set(schedules.map((s) => s.projectId));
    const seen = new Set<string>();
    const all: SchedulableProject[] = [
      ...projects,
      ...added.map((p) => ({
        id: p.id,
        projectNumber: p.projectNumber,
        projectName: p.projectName,
        client: p.client,
      })),
    ];
    return all
      .filter((p) => {
        if (scheduled.has(p.id) || scheduled.has(p.projectNumber) || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      })
      .map((p) => ({
        // Keyed by row id so the first save matches the app's own convention.
        key: p.id,
        projectNumber: p.projectNumber,
        projectName: p.projectName,
        location:
          directory[p.projectNumber]?.location ??
          added.find((a) => a.projectNumber === p.projectNumber)?.location ??
          "—",
        client: p.client || directory[p.projectNumber]?.client || "—",
        count: 0,
      }));
  }, [schedules, projects, added, directory]);

  const rows = useMemo(() => [...scheduledRows, ...unscheduledRows], [scheduledRows, unscheduledRows]);

  // The selection is only real once a row backs it. This is also what makes an
  // unknown `?project=` harmless: no row, so the picker renders — the same
  // picker as an empty selection, not the bare fallback this guard used to hand
  // back further down, and never an empty programme.
  const row = sel ? rows.find((r) => r.key === sel) : undefined;

  function openNewProject() {
    setNewOpen(false);
    setAddProjectOpen(true);
  }

  /** Created inline → list it, then drop straight into its empty programme. */
  function onProjectCreated(project: CreatedProject) {
    setAdded((p) => [...p, project]);
    setAddProjectOpen(false);
    setSel(project.id);
  }

  if (!row)
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <div className="relative">
            <button
              type="button"
              onClick={() => setNewOpen((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
            >
              <Plus className="h-4 w-4" /> New Schedule
            </button>
            {newOpen ? (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setNewOpen(false)} aria-hidden />
                <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-border bg-surface p-1 shadow-lg">
                  <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-faint">
                    Choose a project to schedule
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {rows.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-muted">No projects yet.</div>
                    ) : (
                      rows.map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          onClick={() => { setSel(r.key); setNewOpen(false); }}
                          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-surface-2"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{r.projectName}</span>
                            <span className="block truncate text-xs text-muted">{r.projectNumber} · {r.client}</span>
                          </span>
                          <span className="shrink-0 text-[11px] text-faint">
                            {r.count ? `${r.count} tasks` : "No programme yet"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  {/* Pinned so the list never dead-ends when the project is missing. */}
                  <button
                    type="button"
                    onClick={openNewProject}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-border px-3 py-2.5 text-left text-sm font-medium text-brand transition-colors hover:bg-surface-2"
                  >
                    <FolderPlus className="h-4 w-4" /> Add new project
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
        {addProjectOpen ? (
          <NewProjectPanel
            clients={clients}
            submitLabel="Create project & schedule it"
            onCreated={onProjectCreated}
            onCancel={() => setAddProjectOpen(false)}
          />
        ) : null}
        <ProjectPicker title="Schedule" countLabel="Tasks" rows={rows} onSelect={setSel} />
      </div>
    );

  // A project with no saved programme opens on an empty one; the Gantt's Save
  // upserts by projectId, so the first save creates the row.
  const selected: ProjectSchedule =
    schedules.find((s) => s.projectId === sel) ?? {
      projectId: row.key,
      projectNumber: row.projectNumber,
      projectName: row.projectName,
      client: row.client === "—" ? "" : row.client,
      manager: "",
      start: "",
      end: "",
      tasks: [],
    };

  return (
    <div className="space-y-3">
      {/* PROTECTED SYSTEM — layout/chrome change, approved 2026-08-04.
        *
        * One header row, owned here. Email and Print preview used to live in
        * different components — Email here, Print preview inside ScheduleGantt —
        * so they rendered as two right-aligned rows stacked on top of each other.
        * They belong together under the topbar's account button, and this is the
        * only component that already holds everything both of them need: the row
        * for Email's subject, and `row.projectId` for the print href. Pulling the
        * link up therefore lifts no state; ScheduleGantt simply stopped drawing a
        * header of its own.
        */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <ProjectCrumb row={row} onBack={() => setSel(null)} emphasizeNumber />
        <div className="flex items-center gap-2">
          <EmailButton subject={`Programme — ${row.projectName}`} attachment={`${row.projectName} — Schedule.pdf`} />
          <Link
            href={`/print/schedule/${selected.projectId}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          >
            <Printer className="h-4 w-4" /> Print preview
          </Link>
        </div>
      </div>
      <ScheduleGantt schedules={[selected]} />
    </div>
  );
}
