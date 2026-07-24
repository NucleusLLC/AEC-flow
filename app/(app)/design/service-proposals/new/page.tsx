import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ServiceProposalForm } from "@/components/service-proposals/service-proposal-form";
import { getClients } from "@/lib/data/clients";
import { getProjects } from "@/lib/data/projects";

export const metadata: Metadata = { title: "New Service Proposal · AEC-flow" };

export default async function NewServiceProposalPage() {
  const [clients, projects] = await Promise.all([getClients(), getProjects()]);

  return (
    <div className="w-full space-y-6">
      <Link
        href="/design/service-proposals"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Service Proposals
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">New Service Proposal</h2>
        <p className="text-sm text-muted">
          The proposal number is assigned on save. Fees and the payment schedule calculate live.
        </p>
      </div>
      <ServiceProposalForm
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        mode="new"
      />
    </div>
  );
}
