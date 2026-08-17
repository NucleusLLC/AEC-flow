"use client";

/**
 * The intake screen: pick the project, then drop files.
 *
 * WHY THE PROJECT IS PICKED FIRST AND NOT GUESSED. The extractor can read a
 * project NUMBER off a filename or a title block, and it is tempting to match
 * that against the project list and skip this step. It is also how a sheet ends
 * up filed against the wrong job when two projects share a numbering habit, and
 * that error is invisible afterwards: the sheet simply is not where anyone
 * looks for it. Choosing once, deliberately, costs one click per batch.
 *
 * WHY THE "NO PROJECTS YET" CARD IS GONE. It read "Create a project first, then
 * come back here to add its drawing set" — which is a dead end with good manners:
 * the user has a folder of drawings open and is told to leave, find the projects
 * screen, and find their way back. The picker creates the project instead.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ProjectSelect } from "@/components/projects/project-select";
import { DrawingIntake } from "./drawing-intake";
import { serverIntakeRepository } from "./intake-repository";

export type IntakeProjectOption = {
  id: string;
  projectNumber: string;
  name: string;
};

export function DrawingIntakeWorkspace({
  projects,
  initialProjectId,
  storageConnected,
}: {
  projects: IntakeProjectOption[];
  initialProjectId?: string;
  storageConnected: boolean;
}) {
  const router = useRouter();
  const [projectList, setProjectList] = useState(projects);
  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? "");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Project" subtitle="Every sheet in this batch is filed against it." />
        <CardBody>
          <ProjectSelect
            id="intake-project"
            projects={projectList}
            value={projectId}
            onChange={setProjectId}
            submitLabel="Create project & file drawings to it"
            onCreated={(p) =>
              setProjectList((prev) => [
                ...prev,
                { id: p.id, projectNumber: p.projectNumber, name: p.projectName },
              ])
            }
            className="max-w-xl"
          />

          {!storageConnected ? (
            <p className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
              File storage is not connected on this deployment, so uploads are disabled. Set
              SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and create the private bucket.
            </p>
          ) : null}
        </CardBody>
      </Card>

      {/* Withheld until a project exists to file against — the drop zone used to
          be unreachable in that state anyway, and an upload keyed to an empty
          projectId would be filed nowhere. This is a one-render wait, not a
          dead end: the picker above is where the project gets created. */}
      {projectId ? (
        <DrawingIntake
          projectId={projectId}
          repository={storageConnected ? serverIntakeRepository : undefined}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}
