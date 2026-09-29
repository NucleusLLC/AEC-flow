import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DocumentComposer } from "@/components/general-documents/document-composer";
import { getClients } from "@/lib/data/clients";
import { getProjects } from "@/lib/data/projects";
import { getFirmIdentity } from "@/lib/server/firm";
import { ymd } from "@/lib/building-permits/register";
import { getServerT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "New document · AEC-flow" };

/** "Write it with AI" runs as a server action from this page; a letter takes
 *  ten to thirty seconds, so allow well beyond that. */
export const maxDuration = 120;

export default async function NewGeneralDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const [{ type }, clients, projects, firm] = await Promise.all([
    searchParams,
    getClients(),
    getProjects(),
    getFirmIdentity(),
  ]);
  const t = await getServerT();

  return (
    <div className="w-full space-y-6">
      <Link
        href="/documents/general"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("General Documents")}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">{t("New document")}</h2>
        <p className="text-sm text-muted">
          {t(
            "Pick what you are writing, fill in the particulars, and read it before it is saved. The number is assigned when you create the draft.",
          )}
        </p>
      </div>
      <DocumentComposer
        mode="new"
        initialType={type}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        firmName={firm.name}
        today={ymd(new Date())}
      />
    </div>
  );
}
