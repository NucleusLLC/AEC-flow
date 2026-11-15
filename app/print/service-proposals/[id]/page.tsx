import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServiceProposal } from "@/lib/data/service-proposals";
import { ServiceProposalDocument } from "@/components/print/service-proposal-document";
import { getServerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Service Proposal")} · ${t("Print")}` };
}

/**
 * Client-facing proposal document.
 *
 * The document itself lives in components/print/service-proposal-document.tsx, shared
 * with the public acceptance page (app/p/[token]) so the client signs exactly what
 * prints here. CONFIDENTIALITY rules are documented there: only client-safe fields.
 */
export default async function ServiceProposalPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getServiceProposal(id);
  if (!p) notFound();
  return <ServiceProposalDocument p={p} backHref={`/design/service-proposals/${p.id}`} />;
}
