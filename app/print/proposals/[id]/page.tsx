import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import { getProposal } from "@/lib/data/proposals";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { PrintSurface } from "@/components/print/print-surface";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const proposal = await getProposal(id);
  return { title: proposal ? `${proposal.refNumber} — Fee Proposal` : "Fee Proposal" };
}

export default async function ProposalPrintPage({ params }: PageProps) {
  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) notFound();
  const { logoDataUrl, logo } = await getPracticeSettings();
  const firm = await getFirmIdentity();
  const companyName = firm.name;

  return (
    // This route used to print the proposal's own reference in the bottom-left
    // margin box in place of the practice strapline, which made it the one
    // document in the suite whose footer read differently from every other. The
    // reference has never depended on that: it is in the letterhead, and again in
    // the document's own end-of-document line, both of which are unchanged.
    <PrintSurface backHref={`/proposals/${proposal.id}`} backLabel="Back to proposal">
      <ProposalDocument
        proposal={proposal}
        logo={{ dataUrl: logoDataUrl, position: logo.position, size: logo.size }}
        companyName={companyName}
        companyLocation={firm.location}
        sheet={false}
      />
    </PrintSurface>
  );
}
