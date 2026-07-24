import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getServiceProposal } from "@/lib/data/service-proposals";
import { isLocked } from "@/lib/proposals/engine/status";
import { ServiceProposalForm } from "@/components/service-proposals/service-proposal-form";
import { getClients } from "@/lib/data/clients";
import { getProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "Edit Service Proposal · AEC-flow" };

export default async function EditServiceProposalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getServiceProposal(id);
  if (!p) notFound();
  // An accepted/converted proposal is immutable — bounce back to the read view.
  if (isLocked(p.status)) redirect(`/design/service-proposals/${p.id}`);

  const [clients, projects] = await Promise.all([getClients(), getProjects()]);

  return (
    <div className="w-full space-y-6">
      <Link href={`/design/service-proposals/${p.id}`} className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> {p.number}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">Edit {p.number}</h2>
        <p className="text-sm text-muted">Fees and the payment schedule recalculate live as you edit.</p>
      </div>
      <ServiceProposalForm
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        mode="edit"
        initial={p}
      />
    </div>
  );
}
