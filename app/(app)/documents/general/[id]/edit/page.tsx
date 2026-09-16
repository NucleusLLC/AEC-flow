import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DocumentComposer } from "@/components/general-documents/document-composer";
import { getGeneralDocument } from "@/lib/data/general-documents";
import { getClients } from "@/lib/data/clients";
import { getProjects } from "@/lib/data/projects";
import { getFirmIdentity } from "@/lib/server/firm";
import { ymd } from "@/lib/building-permits/register";

export const metadata: Metadata = { title: "Edit document · AEC-flow" };

export default async function EditGeneralDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getGeneralDocument(id);
  if (!doc) notFound();
  // Only a draft is editable. Anything issued is a record of what went out, so
  // the route refuses rather than rendering a form whose save would be rejected.
  if (doc.status !== "DRAFT") redirect(`/documents/general/${doc.id}`);

  const [clients, projects, firm] = await Promise.all([
    getClients(),
    getProjects(),
    getFirmIdentity(),
  ]);

  return (
    <div className="w-full space-y-6">
      <Link
        href={`/documents/general/${doc.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {doc.number}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">Edit {doc.number}</h2>
        <p className="text-sm text-muted">{doc.docTypeLabel}</p>
      </div>
      <DocumentComposer
        mode="edit"
        initial={doc}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        firmName={firm.name}
        today={ymd(new Date())}
      />
    </div>
  );
}
