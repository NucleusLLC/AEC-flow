import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProposalForm } from "@/components/proposals/proposal-form";
import { getProposals } from "@/lib/data/proposals";
import { getClients } from "@/lib/data/clients";

export const metadata: Metadata = { title: "New Proposal · AEC-flow" };

/** Next reference in the PRO-YYYY-NNN series (deterministic from existing refs). */
function nextRef(refs: string[]): string {
  let year = 0;
  let max = 0;
  for (const r of refs) {
    const m = /^PRO-(\d{4})-(\d+)$/.exec(r);
    if (!m) continue;
    const y = Number(m[1]);
    const n = Number(m[2]);
    if (y > year) {
      year = y;
      max = n;
    } else if (y === year && n > max) {
      max = n;
    }
  }
  if (!year) year = 2026;
  return `PRO-${year}-${String(max + 1).padStart(3, "0")}`;
}

export default async function NewProposalPage() {
  const [proposals, clients] = await Promise.all([getProposals(), getClients()]);
  const ref = nextRef(proposals.map((p) => p.refNumber));
  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="w-full space-y-6">
      <Link
        href="/proposals"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Proposals
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">New proposal</h2>
        <p className="text-sm text-muted">
          Draft a fee proposal with line items and payment milestones. Reference{" "}
          <span className="font-mono text-fg">{ref}</span>.
        </p>
      </div>
      <ProposalForm mode="new" clients={clientOptions} proposalRef={ref} backHref="/proposals" />
    </div>
  );
}
