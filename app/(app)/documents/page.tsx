import Link from "next/link";
import { Wand2 } from "lucide-react";
import { DocumentsApp } from "@/components/documents/documents-app";
import { getDocuments } from "@/lib/data/documents";
import { getProjectDirectory } from "@/lib/data/projects";

export const metadata = { title: "Documents · AEC-flow" };

export default async function DocumentsPage() {
  const [documents, directory] = await Promise.all([getDocuments(), getProjectDirectory()]);

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">Documents</h2>
          <p className="text-sm text-muted">
            Pick a project to open its documents — presentations, reports, specs, contracts.
          </p>
        </div>
        {/* Was a `<button>` with no handler — it looked like the way in and did
            nothing. There is no upload backend to wire it to, so it now points
            at the generator, which is the one path that actually files a
            document against a project. */}
        <Link
          href="/documents/generate"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Wand2 className="h-4 w-4" aria-hidden="true" />
          Generate
        </Link>
      </div>

      <DocumentsApp documents={documents} directory={directory} />
    </div>
  );
}
