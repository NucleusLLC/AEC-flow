import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ContractWorkspace } from "@/components/contracts/contract-workspace";
import { contractFamily, getContract } from "@/lib/data/contracts";
import { RevisionHistory } from "@/components/contracts/revision-history";
import { diffContracts, revisionLabel, type ContractDiff } from "@/lib/contracts/revision";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE } from "@/lib/contracts/types";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Contract · AEC-flow" };

export default async function ContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) notFound();

  // The versions of this agreement, and what changed in this one. The diff is
  // against the version immediately BEFORE this one in the family, not against
  // whatever `supersedesId` happens to point at: opening Rev B should answer
  // "what changed in Rev B", whichever version its author started from.
  const family = await contractFamily(contract.id);
  const index = family.findIndex((v) => v.id === contract.id);
  const previous = index > 0 ? family[index - 1] : null;
  const before = previous ? await getContract(previous.id) : null;
  const diff: ContractDiff | null = before
    ? diffContracts(
        { facts: before.facts, body: before.body },
        { facts: contract.facts, body: contract.body },
      )
    : null;

  // Superseded and void contracts are history; a revision is written from the
  // version that is actually in force.
  const revisable = contract.status === "ISSUED" || contract.status === "SIGNED";

  return (
    <div className="w-full space-y-4">
      <Link
        href="/documents/contracts"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Contracts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold text-fg">
            <span className="font-mono text-base text-faint">{contract.number}</span>
            {contract.projectName}
            <Badge tone={CONTRACT_STATUS_TONE[contract.status]}>
              {CONTRACT_STATUS_LABEL[contract.status]}
            </Badge>
          </h2>
          <p className="text-sm text-muted">
            {contract.employerName} and {contract.contractorName}
            {contract.templateName ? ` · from ${contract.templateName}` : ""}
            {contract.generatedAt ? ` · written ${formatDate(contract.generatedAt.slice(0, 10))}` : ""}
            {family.length > 1 ? ` · ${revisionLabel(contract.number)}` : ""}
          </p>
        </div>

        {revisable ? (
          <Link
            href={`/documents/contracts/${contract.id}/revise`}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <GitBranch className="h-4 w-4" />
            Revise
          </Link>
        ) : null}
      </div>

      {contract.status === "VOID" && contract.voidReason ? (
        <p className="rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-sm text-red-600">
          Voided — {contract.voidReason}
        </p>
      ) : null}

      <ContractWorkspace
        id={contract.id}
        number={contract.number}
        status={contract.status}
        currency={contract.currency}
        exchangeRate={contract.exchangeRate}
        names={[contract.employerName, contract.contractorName].filter(Boolean)}
        initialBody={contract.body}
      />

      <RevisionHistory
        family={family}
        currentId={contract.id}
        diff={diff}
        previousNumber={previous?.number ?? null}
      />
    </div>
  );
}
