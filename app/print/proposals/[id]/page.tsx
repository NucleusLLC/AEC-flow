import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/proposals/print-button";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import { getProposal } from "@/lib/data/proposals";
import { getPracticeSettings } from "@/lib/server/practice-config";

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

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Toolbar — hidden when printing */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 print:hidden">
        <Link
          href={`/proposals/${proposal.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to proposal
        </Link>
        <PrintButton />
      </div>

      {/* A4-ish document sheet — shared with the in-app preview */}
      <div className="my-6 print:my-0">
        <ProposalDocument proposal={proposal} logo={{ dataUrl: logoDataUrl, position: logo.position, size: logo.size }} />
      </div>
    </div>
  );
}
