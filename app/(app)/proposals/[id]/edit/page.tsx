import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProposalForm, type ProposalFormValues } from "@/components/proposals/proposal-form";
import { getProposal } from "@/lib/data/proposals";
import { getClients } from "@/lib/data/clients";
import { getTeam } from "@/lib/data/team";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const proposal = await getProposal(id);
  return { title: proposal ? `Edit ${proposal.refNumber} · AEC-flow` : "Edit Proposal · AEC-flow" };
}

export default async function EditProposalPage({ params }: PageProps) {
  const { id } = await params;
  const [proposal, clients, team] = await Promise.all([
    getProposal(id),
    getClients(),
    getTeam(),
  ]);
  if (!proposal) notFound();

  const initial: ProposalFormValues = {
    title: proposal.title,
    clientId: proposal.clientId,
    owner: proposal.owner,
    status: proposal.status,
    currency: proposal.currency,
    validUntil: proposal.validUntil ?? "",
    estimatedDuration: proposal.estimatedDuration != null ? String(proposal.estimatedDuration) : "",
    scopeSummary: proposal.scopeSummary ?? "",
    exclusions: proposal.exclusions ?? "",
    terms: proposal.terms ?? "",
    lineItems: proposal.lineItems.length
      ? proposal.lineItems.map((li) => ({
          description: li.description,
          discipline: li.discipline ?? "",
          amount: li.amount,
          isOptional: li.isOptional,
        }))
      : [{ description: "", discipline: "", amount: 0, isOptional: false }],
    milestones: proposal.milestones.length
      ? proposal.milestones.map((m) => ({ name: m.name, percentage: m.percentage }))
      : [{ name: "Appointment", percentage: 30 }],
  };

  const backHref = `/proposals/${proposal.id}`;

  return (
    <div className="w-full space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {proposal.refNumber}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">Edit proposal</h2>
        <p className="text-sm text-muted">
          <span className="font-mono text-fg">{proposal.refNumber}</span> · {proposal.title}
        </p>
      </div>
      <ProposalForm
        mode="edit"
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        owners={team.map((u) => ({ name: u.name }))}
        proposalRef={proposal.refNumber}
        initial={initial}
        backHref={backHref}
      />
    </div>
  );
}
