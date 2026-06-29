import { Upload } from "lucide-react";
import { DrawingsApp } from "@/components/drawings/drawings-app";
import { getDrawings } from "@/lib/data/drawings";
import { getProjectDirectory } from "@/lib/data/projects";

export const metadata = { title: "Drawings · AEC-flow" };

export default async function DrawingsPage() {
  const [drawings, directory] = await Promise.all([getDrawings(), getProjectDirectory()]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Drawings</h2>
          <p className="text-sm text-muted">
            Pick a project to open its drawing set — every plan and sheet by discipline and revision.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Upload className="h-4 w-4" />
          Upload
        </button>
      </div>

      <DrawingsApp drawings={drawings} directory={directory} />
    </div>
  );
}
