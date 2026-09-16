import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DocumentComposer } from "@/components/general-documents/document-composer";
import { getClients } from "@/lib/data/clients";
import { getProjects } from "@/lib/data/projects";
import { getFirmIdentity } from "@/lib/server/firm";
import { ymd } from "@/lib/building-permits/register";

export const metadata: Metadata = { title: "New document · AEC-flow" };

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

  return (
    <div className="w-full space-y-6">
      <Link
        href="/documents/general"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        General Documents
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">New document</h2>
        <p className="text-sm text-muted">
          Pick what you are writing, fill in the particulars, and read it before it is saved. The
          number is assigned when you create the draft.
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
