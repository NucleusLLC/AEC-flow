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
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
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
  const [projectId, setProjectId] = useState(initialProjectId ?? projects[0]?.id ?? "");

  if (projects.length === 0) {
    return (
      <Card>
        <CardHeader title="No projects yet" subtitle="A drawing has to belong to a project." />
        <CardBody>
          <p className="text-sm text-muted">
            Create a project first, then come back here to add its drawing set.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Project" subtitle="Every sheet in this batch is filed against it." />
        <CardBody>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
            </span>
            <label htmlFor="intake-project" className="sr-only">
              Project
            </label>
            <select
              id="intake-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-9 min-w-[18rem] rounded-lg border border-border bg-surface px-2.5 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectNumber} — {p.name}
                </option>
              ))}
            </select>
          </div>

          {!storageConnected ? (
            <p className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
              File storage is not connected on this deployment, so uploads are disabled. Set
              SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, and create the private bucket.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <DrawingIntake
        projectId={projectId}
        repository={storageConnected ? serverIntakeRepository : undefined}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
