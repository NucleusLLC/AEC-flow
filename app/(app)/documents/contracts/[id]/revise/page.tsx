import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitBranch } from "lucide-react";
import { ContractComposer } from "@/components/contracts/contract-composer";
import { getContract, listTemplates, nextRevisionNumberPreview, practicePeople } from "@/lib/data/contracts";
import { getProjects } from "@/lib/data/projects";
import { getAnthropicKeyStatus } from "@/lib/server/ai-config";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { getSystemCurrency } from "@/lib/format";
import { revisionLabel } from "@/lib/contracts/revision";
import type { ContractFacts } from "@/lib/contracts/types";

export const metadata: Metadata = { title: "Revise contract · AEC-flow" };

/**
 * Write a revision of an existing contract.
 *
 * The particulars start from the contract being replaced, so revising a
 * completion date does not mean retyping thirty fields — and, more to the
 * point, does not mean quietly losing the twenty-nine that were not retyped.
 * The document is generated afresh from the template either way: an issued
 * contract is superseded, never edited.
 */
export default async function ReviseContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) notFound();

  const [projects, templates, people, keyStatus, practice, firm, nextNumber] = await Promise.all([
    getProjects(),
    listTemplates(),
    practicePeople(),
    getAnthropicKeyStatus(),
    getPracticeSettings(),
    getFirmIdentity(),
    nextRevisionNumberPreview(id),
  ]);

  const facts: ContractFacts = contract.facts;

  return (
    <div className="w-full space-y-4">
      <Link
        href={`/documents/contracts/${contract.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> {contract.number}
      </Link>

      <div>
        <h2 className="text-xl font-semibold text-fg">Revise this contract</h2>
        <p className="text-sm text-muted">
          Change what needs changing; everything else comes across as it stands.
        </p>
      </div>

      <p className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-fg">
        <GitBranch className="h-4 w-4 shrink-0 text-amber-600" />
        <span>
          <span className="font-mono">{contract.number}</span> ({revisionLabel(contract.number)}) will
          be superseded by <span className="font-mono">{nextNumber}</span>. The agreement keeps its
          number — only the revision letter moves.
        </span>
      </p>

      <ContractComposer
        projects={projects.map((p) => ({
          id: p.id,
          projectNumber: p.projectNumber,
          name: p.name,
          siteAddress: null,
        }))}
        templates={templates}
        people={people}
        practiceName={firm.name || practice.footer.text}
        hasAiKey={keyStatus.configured}
        hasLogo={Boolean(firm.logo?.dataUrl)}
        defaultCurrency={getSystemCurrency()}
        revising={{
          id: contract.id,
          number: contract.number,
          nextNumber,
          facts,
          templateId: contract.templateId,
        }}
      />
    </div>
  );
}
