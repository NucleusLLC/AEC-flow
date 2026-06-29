import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FileText,
  ClipboardList,
  CalendarClock,
  Hash,
  Pencil,
  Printer,
  Building2,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProposalStatusBadge } from "@/components/proposals/badges";
import { SectionHeader } from "@/components/proposals/ui";
import { ProposalPreviewButton } from "@/components/proposals/proposal-preview";
import {
  getProposal,
  committedFee,
  optionalFee,
  DISCIPLINE_LABEL,
} from "@/lib/data/proposals";
import { formatCurrency, formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const proposal = await getProposal(id);
  return {
    title: proposal ? `${proposal.refNumber} · ${proposal.title} · AEC-flow` : "Proposal · AEC-flow",
  };
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-xs font-medium text-muted">{label}</span>
      <span className="text-right text-sm text-fg">{children}</span>
    </div>
  );
}

function TextCard({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  return (
    <Card>
      <SectionHeader title={title} />
      <CardBody>
        <p className="text-sm leading-relaxed text-muted">{body}</p>
      </CardBody>
    </Card>
  );
}

export default async function ProposalDetailPage({ params }: PageProps) {
  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) notFound();

  const committed = committedFee(proposal);
  const optional = optionalFee(proposal);
  const lineItems = [...proposal.lineItems].sort((a, b) => a.sortOrder - b.sortOrder);
  const milestoneTotal = proposal.milestones.reduce((n, m) => n + m.percentage, 0);
  const printHref = `/print/proposals/${proposal.id}`;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link
        href="/proposals"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Proposals
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">{proposal.refNumber}</span>
            <ProposalStatusBadge status={proposal.status} />
            {proposal.revision > 1 ? (
              <span className="text-[11px] text-faint">revision {proposal.revision}</span>
            ) : null}
          </div>
          <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-fg">{proposal.title}</h2>
          {proposal.clientId ? (
            <Link
              href={`/clients/${proposal.clientId}`}
              className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-brand hover:underline"
            >
              <Building2 className="h-3.5 w-3.5" />
              {proposal.clientName}
            </Link>
          ) : (
            <span className="mt-1 block text-sm text-muted">{proposal.clientName}</span>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ProposalPreviewButton proposal={proposal} printHref={printHref} />
          <a
            href={printHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </a>
          <Link
            href={`/proposals/${proposal.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          {/* Orders module is not in the beta — show any linked order as a static badge
              (no /orders route yet) and omit the non-functional "Convert to order" action. */}
          {proposal.orderNumber ? (
            <span
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-sm font-medium text-muted"
              title="Linked order"
            >
              <ClipboardList className="h-4 w-4" />
              {proposal.orderNumber}
            </span>
          ) : null}
        </div>
      </div>

      {/* Fee banner */}
      <Card className="overflow-hidden border-l-[3px] border-l-brand p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Total fee</div>
            <div className="mt-1 text-3xl font-bold tracking-tight text-fg">
              {formatCurrency(proposal.totalFee, proposal.currency)}
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <div className="text-xs font-medium text-muted">Committed</div>
              <div className="mt-0.5 font-semibold text-fg">
                {formatCurrency(committed, proposal.currency)}
              </div>
            </div>
            {optional > 0 ? (
              <div>
                <div className="text-xs font-medium text-muted">Optional add-ons</div>
                <div className="mt-0.5 font-semibold text-fg">
                  {formatCurrency(optional, proposal.currency)}
                </div>
              </div>
            ) : null}
            {proposal.estimatedDuration ? (
              <div>
                <div className="text-xs font-medium text-muted">Duration</div>
                <div className="mt-0.5 font-semibold text-fg">{proposal.estimatedDuration} weeks</div>
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: line items, milestones, scope text */}
        <div className="space-y-5 lg:col-span-2">
          {/* Line items */}
          <Card>
            <SectionHeader
              title="Line Items"
              subtitle={`${lineItems.length} item${lineItems.length === 1 ? "" : "s"}`}
              action={<FileText className="h-4 w-4 text-faint" />}
            />
            {lineItems.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-border">
                    {lineItems.map((li) => (
                      <tr key={li.id} className="transition-colors hover:bg-surface-2/60">
                        <td className="px-5 py-2">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold text-fg">{li.description}</span>
                            {li.discipline ? (
                              <Badge tone="slate">{DISCIPLINE_LABEL[li.discipline]}</Badge>
                            ) : null}
                            {li.isOptional ? <Badge tone="amber">optional</Badge> : null}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-2 text-right align-middle font-semibold tabular-nums text-fg">
                          {formatCurrency(li.amount, proposal.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-surface-2/40">
                      <td className="px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-fg">
                        Committed total
                      </td>
                      <td className="px-5 py-2.5 text-right font-bold tabular-nums text-fg">
                        {formatCurrency(committed, proposal.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <CardBody className="text-sm text-muted">No line items captured yet.</CardBody>
            )}
          </Card>

          {/* Milestones */}
          <Card>
            <SectionHeader
              title="Payment Milestones"
              subtitle={milestoneTotal === 100 ? "100% of fee" : `${milestoneTotal}% allocated`}
              action={<CalendarClock className="h-4 w-4 text-faint" />}
            />
            {proposal.milestones.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                      <th className="px-5 py-2 font-semibold">Milestone</th>
                      <th className="px-3 py-2 font-semibold text-center">When</th>
                      <th className="px-3 py-2 font-semibold text-right">Share</th>
                      <th className="px-5 py-2 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {proposal.milestones.map((m) => (
                      <tr key={m.id} className="transition-colors hover:bg-surface-2/60">
                        <td className="px-5 py-2 font-semibold text-fg">{m.name}</td>
                        <td className="px-3 py-2 text-center text-muted">
                          {m.dueWeek === null ? "—" : m.dueWeek === 0 ? "Kickoff" : `Week ${m.dueWeek}`}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted">{m.percentage}%</td>
                        <td className="px-5 py-2 text-right font-semibold tabular-nums text-fg">
                          {formatCurrency(Math.round((proposal.totalFee * m.percentage) / 100), proposal.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <CardBody className="text-sm text-muted">No payment milestones captured yet.</CardBody>
            )}
          </Card>

          <TextCard title="Scope Summary" body={proposal.scopeSummary} />
          <TextCard title="Exclusions" body={proposal.exclusions} />
          <TextCard title="Assumptions" body={proposal.assumptions} />
          <TextCard title="Terms" body={proposal.terms} />
        </div>

        {/* Right: details + follow-up */}
        <div className="space-y-5">
          <Card>
            <SectionHeader title="Details" />
            <CardBody className="divide-y divide-border py-0">
              <DetailRow label="Client">
                {proposal.clientId ? (
                  <Link href={`/clients/${proposal.clientId}`} className="hover:text-brand hover:underline">
                    {proposal.clientName}
                  </Link>
                ) : (
                  proposal.clientName
                )}
              </DetailRow>
              <DetailRow label="Owner">{proposal.owner}</DetailRow>
              <DetailRow label="Status">
                <ProposalStatusBadge status={proposal.status} />
              </DetailRow>
              <DetailRow label="Revision">
                <span className="inline-flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5 text-faint" />
                  {proposal.revision}
                </span>
              </DetailRow>
              <DetailRow label="Created">{formatDate(proposal.createdAt)}</DetailRow>
              <DetailRow label="Sent">{formatDate(proposal.sentAt)}</DetailRow>
              <DetailRow label="Valid until">{formatDate(proposal.validUntil)}</DetailRow>
              {proposal.approvedAt ? (
                <DetailRow label="Approved">{formatDate(proposal.approvedAt)}</DetailRow>
              ) : null}
              {proposal.orderNumber ? (
                <DetailRow label="Order">
                  <span className="font-mono text-xs text-muted">{proposal.orderNumber}</span>
                </DetailRow>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <SectionHeader title="Follow-up" />
            <CardBody className="space-y-3">
              {proposal.nextAction ? (
                <div>
                  <div className="text-xs font-medium text-muted">Next action</div>
                  <div className="mt-0.5 text-sm font-medium text-fg">{proposal.nextAction}</div>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                  <CalendarClock className="h-3.5 w-3.5 text-faint" />
                  Follow-up
                </span>
                <span className="text-sm text-fg">{formatDate(proposal.followUpDate)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-medium text-muted">Last contact</span>
                <span className="text-sm text-fg">{formatDate(proposal.lastContactDate)}</span>
              </div>
              {proposal.followUpNotes ? (
                <p className="border-t border-border pt-3 text-sm leading-relaxed text-muted">
                  {proposal.followUpNotes}
                </p>
              ) : null}
              {!proposal.nextAction && !proposal.followUpDate && !proposal.followUpNotes ? (
                <p className="text-sm text-muted">No follow-up scheduled.</p>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
