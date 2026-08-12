import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DrawingIntakeWorkspace } from "@/components/drawings/intake-workspace";
import { getProjects } from "@/lib/data/projects";
import { isStorageConfigured } from "@/lib/server/storage";

export const metadata = { title: "Add drawings · AEC-flow" };

export default async function DrawingIntakePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const [{ project }, projects] = await Promise.all([searchParams, getProjects()]);

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Add drawings</h2>
          <p className="text-sm text-muted">
            Drop a sheet set. What the file says about itself is read back to you as a proposal —
            check it, correct it, then confirm.
          </p>
        </div>
        <Link
          href="/drawings"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Register
        </Link>
      </div>

      <DrawingIntakeWorkspace
        projects={projects.map((p) => ({ id: p.id, projectNumber: p.projectNumber, name: p.name }))}
        initialProjectId={project}
        storageConnected={isStorageConfigured()}
      />
    </div>
  );
}
