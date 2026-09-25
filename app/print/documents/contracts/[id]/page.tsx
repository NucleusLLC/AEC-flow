import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { PrintSurface } from "@/components/print/print-surface";
import { ContractDocument } from "@/components/contracts/contract-document";
import { getContract } from "@/lib/data/contracts";
import { getFirmIdentity } from "@/lib/server/firm";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { militaryDate } from "@/lib/building-permits/register";
import { CONTRACT_STATUS_LABEL } from "@/lib/contracts/types";

export const metadata: Metadata = { title: "Contract · Print" };

/**
 * The contract on the practice letterhead, paginated by the app's own engine.
 *
 * PAGE OVERFLOW LIVES HERE, and none of it is this route's code. `PrintSurface`
 * resolves the sheet geometry once and hands it to both `PageRules` — which
 * emits the `@page` margins and the footer band with its `P i of P n` — and
 * `PagedPreview`, whose measuring pass paginates against exactly those numbers,
 * pushes a stranded heading onto the next sheet, and never splits a block that
 * declares itself atomic.
 *
 * The contract's own job is to declare what is atomic: the payment schedule,
 * the party cards and the execution blocks each carry `data-keep-together`,
 * which `collectAtoms` reads. Everything else is prose, and flows.
 *
 * A DRAFT prints saying so. A contract that does not say it is a draft is one
 * that gets signed by accident.
 */
export default async function ContractPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contract, firm, practice] = await Promise.all([
    getContract(id),
    getFirmIdentity(),
    getPracticeSettings(),
  ]);
  if (!contract) notFound();

  const dated = militaryDate((contract.issuedAt ?? contract.createdAt).slice(0, 10));

  return (
    <PrintSurface
      backHref={`/documents/contracts/${id}`}
      backLabel={contract.number}
      paper="A4"
      orientation="portrait"
      margins="standard"
    >
      <DocumentLetterhead
        logo={{
          dataUrl: practice.logoDataUrl,
          position: practice.logo.position,
          size: practice.logo.size,
        }}
        name={firm.name}
        tagline="Architecture · Engineering · Project Management"
        details={
          <div className="text-right text-sm">
            <div className="font-semibold uppercase tracking-wide text-gray-900">
              {CONTRACT_STATUS_LABEL[contract.status]} contract
            </div>
            <div className="font-mono text-xs text-gray-700">{contract.number}</div>
            <div className="text-xs text-gray-700">
              {[contract.projectNumber, contract.projectName].filter(Boolean).join(" · ")}
            </div>
            <div className="text-xs text-gray-700">{dated}</div>
          </div>
        }
      />

      <ContractDocument
        body={contract.body}
        currency={contract.currency}
        exchangeRate={contract.exchangeRate}
        names={[contract.employerName, contract.contractorName].filter(Boolean)}
        contractNumber={contract.number}
        draft={contract.status === "DRAFT"}
      />
    </PrintSurface>
  );
}
