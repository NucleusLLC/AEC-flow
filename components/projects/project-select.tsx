"use client";

/**
 * Project picker that can create the project. See
 * `components/forms/creatable-select` for why this pattern exists at all.
 *
 * WHY THIS ONE USES `renderCreate` INSTEAD OF A FIELD LIST. A project is the one
 * record here whose minimum viable form contains another picker — it must belong
 * to a client, which the user may not have either. That is two levels of "the
 * thing I need does not exist yet", and no flat list of text inputs expresses
 * it. So the create panel is `NewProjectPanel`: the same component the Schedule
 * and Estimates modules already use, which owns the `saveProject` call, the
 * standard six phases, and (since the client dead-end fix) a `ClientSelect` of
 * its own. Nesting it here means there is exactly one "new project" form in the
 * app, not two that drift.
 *
 * WHY THE CLIENT LIST IS FETCHED, NOT PASSED. Hosts of this picker include
 * `components/drawings/intake-workspace.tsx` and the meetings form, whose server
 * pages load projects but not clients. Threading a second list prop through
 * every one of them — and through the protected panels that also render
 * NewProjectPanel — is worse than one lazy read. `listClientOptions` runs only
 * when the user actually opens the create panel.
 */

import { useEffect, useState } from "react";
import { listClientOptions } from "@/app/(app)/clients/actions";
import { CreatableSelect } from "@/components/forms/creatable-select";
import { NewProjectPanel, type CreatedProject } from "./new-project-panel";

export type ProjectOption = {
  id: string;
  name: string;
  /**
   * e.g. "ZA-2026-014". Optional because several hosts only ever mapped id+name
   * out of `getProjects()` and there is no reason to make them all change; the
   * label just falls back to the name. REQUIRED when `by="projectNumber"`, since
   * that is the value being submitted.
   */
  projectNumber?: string;
};

export function ProjectSelect({
  projects,
  value,
  onChange,
  by = "id",
  label = "Project",
  hint,
  allowEmpty,
  placeholder,
  id,
  className,
  labelClassName,
  submitLabel,
  onCreated,
}: {
  projects: ProjectOption[];
  value: string;
  onChange: (value: string) => void;
  /**
   * Which key the host tracks. `projectNumber` is what schedules key off
   * (`ProjectSchedule.projectId`); everything else uses the row id.
   */
  by?: "id" | "projectNumber";
  label?: string;
  hint?: string;
  /** The project link is optional on this form — see `CreatableSelect`. */
  allowEmpty?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  labelClassName?: string;
  /** Passed to the nested panel, e.g. "Create project & file drawings to it". */
  submitLabel?: string;
  onCreated?: (project: CreatedProject) => void;
}) {
  // Null until the create panel is first opened — see the header note.
  const [clients, setClients] = useState<{ id: string; name: string }[] | null>(null);
  const [wanted, setWanted] = useState(false);

  // The fetch has to live in an effect, not in `renderCreate`. With no projects
  // on file the create panel opens immediately, so `renderCreate` runs during
  // the FIRST render — on the server as well, where kicking off a transition
  // throws "startTransition cannot be called during server rendering" and takes
  // the whole route down with a 500.
  useEffect(() => {
    if (!wanted || clients !== null) return;
    let live = true;
    void listClientOptions().then((list) => {
      if (live) setClients(list);
    });
    return () => {
      live = false;
    };
  }, [wanted, clients]);

  return (
    <CreatableSelect
      id={id}
      label={label}
      hint={hint}
      allowEmpty={allowEmpty}
      placeholder={placeholder}
      className={className}
      labelClassName={labelClassName}
      value={value}
      onChange={onChange}
      options={projects.map((p) => ({
        value: by === "id" ? p.id : (p.projectNumber ?? p.id),
        label: p.projectNumber ? `${p.projectNumber} — ${p.name}` : p.name,
      }))}
      addLabel="＋ Add a new project"
      onCreateOpen={() => setWanted(true)}
      renderCreate={({ onCreated: accept, onCancel }) => {
        if (clients === null) return <p className="text-xs text-muted">Loading clients…</p>;
        return (
          <NewProjectPanel
            clients={clients}
            submitLabel={submitLabel}
            onCancel={onCancel}
            onCreated={(project) => {
              onCreated?.(project);
              accept({
                value: by === "id" ? project.id : project.projectNumber,
                label: `${project.projectNumber} — ${project.projectName}`,
              });
            }}
          />
        );
      }}
    />
  );
}
