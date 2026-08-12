import Link from "next/link";
import { getServerT } from "@/lib/i18n/server";
import { Upload, PenTool } from "lucide-react";
import { DrawingsApp } from "@/components/drawings/drawings-app";
import { getDrawings } from "@/lib/data/drawings";
import { getProjectDirectory } from "@/lib/data/projects";

export const metadata = { title: "Drawings · AEC-flow" };

export default async function DrawingsPage() {
  const tr = await getServerT();
  const [drawings, directory] = await Promise.all([getDrawings(), getProjectDirectory()]);

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">{tr("Drawings")}</h2>
          <p className="text-sm text-muted">
            {tr("Pick a project to open its drawing set — every plan and sheet by discipline and revision.")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/drawings/annotate"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <PenTool className="h-4 w-4" />
            Annotate
          </Link>
          <Link
            href="/drawings/intake"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <Upload className="h-4 w-4" />
            Upload
          </Link>
        </div>
      </div>

      <DrawingsApp drawings={drawings} directory={directory} />
    </div>
  );
}
