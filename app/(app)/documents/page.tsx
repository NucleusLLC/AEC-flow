import Link from "next/link";
import { Sparkles, Wand2 } from "lucide-react";
import { DocumentsApp } from "@/components/documents/documents-app";
import { getDocuments } from "@/lib/data/documents";
import { getProjectDirectory } from "@/lib/data/projects";
import { getServerT } from "@/lib/i18n/server";

export const metadata = { title: "Documents · AEC-flow" };

export default async function DocumentsPage() {
  const [documents, directory] = await Promise.all([getDocuments(), getProjectDirectory()]);
  const t = await getServerT();

  return (
    <div className="w-full space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("Documents")}</h2>
          <p className="text-sm text-muted">
            {t("Pick a project to open its documents — presentations, reports, specs, contracts.")}
          </p>
        </div>
        {/* Was a `<button>` with no handler — it looked like the way in and did
            nothing. There is no upload backend to wire it to, so it now points
            at the generator, which is the one path that actually files a
            document against a project. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link
            href="/documents/general/new?type=ai_draft"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/5 px-3 text-sm font-medium text-brand transition-colors hover:bg-brand/10"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {t("Write with AI")}
          </Link>
          <Link
            href="/documents/generate"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <Wand2 className="h-4 w-4" aria-hidden="true" />
            {t("Generate")}
          </Link>
        </div>
      </div>

      <DocumentsApp documents={documents} directory={directory} />
    </div>
  );
}
