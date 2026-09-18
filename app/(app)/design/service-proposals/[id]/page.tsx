import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, LayoutDashboard, Pencil, Printer } from "lucide-react";
import {
  getServiceProposal,
  getServiceProposalIdentification,
  listServiceProposalVersions,
  listStatusHistory,
} from "@/lib/data/service-proposals";
import { computeProposal } from "@/lib/proposals/engine/engine";
import type { ProposalCalcInput } from "@/lib/proposals/engine/types";
import { isIssued, isLocked, STATUS_LABEL } from "@/lib/proposals/engine/status";
import {
  proposalEmailBody,
  proposalEmailNotice,
  proposalEmailSubject,
  proposalRecipient,
  taxLineLabel,
} from "@/lib/proposals/proposal-email";
import { EmailButton } from "@/components/email/email-button";
import { getFirmIdentity } from "@/lib/server/firm";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ServiceProposalStatusBadge } from "@/components/service-proposals/status-badge";
import { ServiceProposalActions } from "@/components/service-proposals/proposal-actions";
import { ProposalIdentificationDetail } from "@/components/service-proposals/proposal-identification";
import { VersionTag } from "@/components/service-proposals/version-tag";
import { formatCurrency, formatDate } from "@/lib/format";
import { bboNote, bboPerMilestone, resolveBbo } from "@/lib/proposals/bbo";

export const metadata: Metadata = { title: "Service Proposal · AEC-flow" };

export default async function ServiceProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getServiceProposal(id);
  if (!p) notFound();

  const [versions, history, identification] = await Promise.all([
    listServiceProposalVersions(p.id),
    listStatusHistory(p.id),
    getServiceProposalIdentification(p),
  ]);
  const calc = computeProposal(p.input as ProposalCalcInput);
  const money = (n: number) => formatCurrency(n, p.currency, { maximumFractionDigits: 2 });
  const locked = isLocked(p.status);

  /**
   * A proposal the client has accepted is a project that is ON, so this screen
   * stops being a quote and becomes a way into the work.
   *
   * Only those statuses: offering the button on a draft, or on one merely
   * approved for issue internally, would promise a project that does not exist
   * yet. It points at the proposal's own project when it has one, and at the
   * projects list when it does not -- which is the honest answer to "where is
   * the project?" for a proposal accepted before anyone created one.
   */
  const projectIsOn =
    p.status === "ACCEPTED" || p.status === "PARTIALLY_ACCEPTED" || p.status === "CONVERTED";
  const projectHref = p.projectId ? `/projects/${p.projectId}` : "/projects";

  /**
   * EMAILING THE PROPOSAL.
   *
   * "Approved for issue" is the line: before it the document is internal, and the
   * accident worth engineering against is a draft reaching the client with the
   * client's own address helpfully pre-typed. The button is still offered — mailing
   * a draft to a colleague for comment is a real thing people do, and a blocked
   * button sends them to their own mail client where nothing is logged — but the
   * address is not filled in and the screen says why.
   *
   * The figures below are the ones already on this page, formatted once by `money`
   * and passed through. lib/proposals/proposal-email does no formatting of its own:
   * a second opinion about what the client owes is exactly the bug worth avoiding.
   */
  const approvedForIssue = p.status === "APPROVED_FOR_ISSUE" || isIssued(p.status);
  const taxLabel = taxLineLabel(calc.totals);
  const firm = await getFirmIdentity();
  const feeLines = [
    { label: "Base fee", amount: money(calc.totals.baseFeeTotal) },
    ...(calc.totals.optionalSelectedTotal > 0
      ? [{ label: "Optional (selected)", amount: money(calc.totals.optionalSelectedTotal) }]
      : []),
    ...(calc.totals.reimbursablesTotal > 0
      ? [{ label: "Reimbursables", amount: money(calc.totals.reimbursablesTotal) }]
      : []),
    { label: "Subtotal", amount: money(calc.totals.subtotal) },
    ...(calc.totals.discountTotal > 0
      ? [{ label: "Discount", amount: `- ${money(calc.totals.discountTotal)}` }]
      : []),
    // The label, not just the number: a tax contained in the price has to say so,
    // or the column reads as an error. See taxLineLabel.
    ...(taxLabel ? [{ label: taxLabel, amount: money(calc.totals.taxTotal) }] : []),
  ];
  const emailInput = {
    number: p.number,
    title: p.title,
    revision: p.revision,
    clientName: identification.clientDisplayName || p.clientName,
    projectName: identification.projectDisplayName || p.projectName,
    issuedAt: p.issuedAt ? formatDate(p.issuedAt) : null,
    validUntil: p.validUntil ? formatDate(p.validUntil) : null,
    lines: feeLines,
    total: money(calc.totals.grandTotal),
    milestones: calc.paymentSchedule.map((m) => ({
      name: m.name,
      percent: m.percent,
      amount: money(m.amount),
    })),
    senderName: firm.name,
  };
  const emailNotice = proposalEmailNotice({
    statusLabel: STATUS_LABEL[p.status],
    approvedForIssue,
    hasContactEmail: Boolean(p.contactEmail?.trim()),
  });
  /**
   * The turnover tax contained in the price, stated rather than left implicit.
   *
   * The practice quotes tax-inclusive, so the fee a client sees is what they
   * pay — which leaves the bookkeeping to work out what part of it was never
   * the practice's. Stating it here, and per milestone below, is what lets the
   * monthly BBO be added up from the proposals instead of re-derived by hand.
   */
  const bbo = resolveBbo({
    currency: p.currency,
    grandTotal: calc.totals.grandTotal,
    taxes: p.input.taxes,
    taxTotal: calc.totals.taxTotal,
    taxableSubtotal: calc.totals.taxableSubtotal,
  });
  const milestoneBbo = bboPerMilestone(calc.paymentSchedule, bbo.amount, p.currency);

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link href="/design/service-proposals" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Service Proposals
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-fg">{p.title}</h2>
            <ServiceProposalStatusBadge status={p.status} />
            <VersionTag
              label={p.versionLabel}
              title="Whole numbers are versions issued to the client; a minor means work in progress."
            />
          </div>
          <p className="mt-1 font-mono text-sm text-muted">
            {p.number}{p.revision > 1 ? ` · rev ${p.revision}` : ""}
            {identification.clientDisplayName ? ` · ${identification.clientDisplayName}` : ""}
            {identification.projectDisplayName ? ` · ${identification.projectDisplayName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {projectIsOn ? (
            /* Green and filled, not another outlined button: this is the one
             * thing to do on an accepted proposal, and it should read that way
             * from across the room. */
            <Link
              href={projectHref}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white shadow-[0_0_0_3px_rgba(16,185,129,0.18)] transition-colors hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Project Dashboard
            </Link>
          ) : null}
          {!locked ? (
            <Link href={`/design/service-proposals/${p.id}/edit`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-muted hover:border-brand hover:text-fg">
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          ) : null}
          <EmailButton
            label="Email proposal"
            subject={proposalEmailSubject(emailInput)}
            attachment={`${p.number} — Service Proposal`}
            defaultTo={proposalRecipient({
              contactEmail: p.contactEmail,
              approvedForIssue,
            })}
            defaultBody={proposalEmailBody(emailInput)}
            relatedType="service-proposal"
            relatedId={p.id}
            linkPath={`/print/service-proposals/${p.id}`}
          />
          <Link href={`/print/service-proposals/${p.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-muted hover:border-brand hover:text-fg">
            <Printer className="h-4 w-4" /> Print / Preview
          </Link>
        </div>
      </div>

      {/* Said on the page, not only inside the compose dialog: the reason the
        * client's address is missing should be readable BEFORE the dialog is
        * opened and the sender starts typing one in by hand. */}
      {emailNotice ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{emailNotice}</span>
        </div>
      ) : null}

      <ServiceProposalActions id={p.id} status={p.status} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {/* Mirrors the identification block that opens the printed document, so what is on
           * screen matches what the client receives. Hidden when there is nothing to show. */}
          {identification.hasAny ? (
            <Card>
              <CardHeader title="Project & client" />
              <CardBody>
                <ProposalIdentificationDetail identification={identification} />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Fee breakdown" />
            <CardBody>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 font-medium">Component</th>
                    <th className="py-2 font-medium">Type</th>
                    <th className="py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.components.map((c) => (
                    <tr key={c.id} className="border-b border-border/60">
                      <td className="py-2 text-fg">
                        {c.label}
                        {c.overrideAmount !== null ? <span className="ml-1.5 text-xs text-amber-600">overridden</span> : null}
                      </td>
                      <td className="py-2 text-muted">
                        {c.category === "BASE" ? "Base" : c.category === "OPTIONAL" ? (c.countedInTotal ? "Optional ✓" : "Optional") : "Additional"}
                      </td>
                      <td className="py-2 text-right tabular-nums text-fg">{money(c.effectiveAmount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td className="py-2 font-semibold text-fg" colSpan={2}>Total sub-total</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-fg">
                      {money(calc.totals.subtotal)}
                    </td>
                  </tr>
                  {calc.totals.discountTotal > 0 ? (
                    <tr>
                      <td className="py-1 text-muted" colSpan={2}>Discount</td>
                      <td className="py-1 text-right tabular-nums text-muted">
                        &minus; {money(calc.totals.discountTotal)}
                      </td>
                    </tr>
                  ) : null}
                  <tr>
                    <td className="py-1 text-muted" colSpan={2}>
                      {bbo.name} {bbo.percent}%
                    </td>
                    <td className="py-1 text-right tabular-nums text-fg">{money(bbo.amount)}</td>
                  </tr>
                  <tr>
                    {/* The one sentence a client and a bookkeeper both need: the
                      * price is not about to grow, and this figure is inside it. */}
                    <td className="pb-1 text-xs text-faint" colSpan={3}>
                      ({bboNote(bbo)}
                      {bbo.source === "default"
                        ? " No tax is set on this proposal, so the practice rate is used."
                        : ""})
                    </td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="py-2 font-semibold text-fg" colSpan={2}>Total fee</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-fg">
                      {money(calc.totals.grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </CardBody>
          </Card>

          {calc.phases.length > 0 ? (
            <Card>
              <CardHeader title="Design phases" />
              <CardBody>
                <table className="w-full text-sm">
                  <tbody>
                    {calc.phases.map((ph) => (
                      <tr key={ph.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 text-fg">{ph.name}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{ph.percent}%</td>
                        <td className="py-2 text-right tabular-nums text-fg">{money(ph.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardBody>
            </Card>
          ) : null}

          {calc.paymentSchedule.length > 0 ? (
            <Card>
              <CardHeader title="Payment schedule" />
              <CardBody>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 font-medium">Milestone</th>
                      <th className="py-2 text-right font-medium">Share</th>
                      <th className="py-2 text-right font-medium">Amount</th>
                      <th className="py-2 text-right font-medium">
                        {bbo.name} incl. ({bbo.percent}%)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.paymentSchedule.map((m) => (
                      <tr key={m.id} className="border-b border-border/60">
                        <td className="py-2 text-fg">{m.name}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{m.percent}%</td>
                        <td className="py-2 text-right tabular-nums text-fg">{money(m.amount)}</td>
                        {/* Allocated, not a percentage of each row: the column
                          * has to add up to the figure in the fee breakdown. */}
                        <td className="py-2 text-right tabular-nums text-muted">
                          {money(milestoneBbo[m.id] ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <td className="py-2 font-semibold text-fg" colSpan={2}>Total</td>
                      <td className="py-2 text-right font-semibold tabular-nums text-fg">
                        {money(calc.totals.grandTotal)}
                      </td>
                      <td className="py-2 text-right font-semibold tabular-nums text-fg">
                        {money(bbo.amount)}
                      </td>
                    </tr>
                    <tr>
                      <td className="pb-1 text-xs text-faint" colSpan={4}>
                        ({bboNote(bbo)}{" "}Each milestone&rsquo;s share becomes payable in the
                        month it is invoiced.)
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </CardBody>
            </Card>
          ) : null}

          {(p.input.scopeItems && p.input.scopeItems.length > 0) ? (
            <Card>
              <CardHeader title="Scope of services" />
              <CardBody>
                <ul className="space-y-1.5 text-sm">
                  {p.input.scopeItems.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className={s.included ? "text-emerald-600" : "text-rose-500"}>{s.included ? "✓" : "✕"}</span>
                      <span className={s.included ? "text-fg" : "text-muted line-through"}>
                        <strong className="font-medium">{s.title}</strong>
                        {s.description ? <span className="text-muted"> — {s.description}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {p.input.scopeSummary || p.input.terms || p.input.exclusions || p.input.assumptions ? (
            <Card>
              <CardHeader title="Narrative & terms" />
              <CardBody className="space-y-3 text-sm">
                {p.input.scopeSummary ? <Field label="Scope" value={p.input.scopeSummary} /> : null}
                {p.input.exclusions ? <Field label="Exclusions" value={p.input.exclusions} /> : null}
                {p.input.assumptions ? <Field label="Assumptions" value={p.input.assumptions} /> : null}
                {p.input.terms ? <Field label="Terms" value={p.input.terms} /> : null}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="card-surface rounded-xl border border-border bg-surface p-4">
            <h3 className="text-sm font-semibold text-fg">Totals</h3>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row k="Base fee" v={money(calc.totals.baseFeeTotal)} />
              {calc.totals.optionalSelectedTotal > 0 ? <Row k="Optional (selected)" v={money(calc.totals.optionalSelectedTotal)} /> : null}
              {calc.totals.reimbursablesTotal > 0 ? <Row k="Reimbursables" v={money(calc.totals.reimbursablesTotal)} /> : null}
              <Row k="Subtotal" v={money(calc.totals.subtotal)} />
              {calc.totals.discountTotal > 0 ? <Row k="Discount" v={`− ${money(calc.totals.discountTotal)}`} /> : null}
              {/* Named, not "Tax": the sidebar, the fee table and the printed
                * sheet all state the same figure the same way. */}
              {bbo.amount > 0 ? <Row k={`${bbo.name} ${bbo.percent}%`} v={money(bbo.amount)} /> : null}
              <div className="mt-1.5 flex justify-between border-t border-border pt-2 text-base font-semibold text-fg">
                <dt>Grand total</dt>
                <dd className="tabular-nums">{money(calc.totals.grandTotal)}</dd>
              </div>
            </dl>
            {calc.basis ? (
              <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
                {calc.basis.label}: <span className="tabular-nums text-fg">{money(calc.basis.amount)}</span>
                {calc.basis.sourceField ? ` (${calc.basis.sourceField})` : ""}
              </p>
            ) : null}
          </div>

          {p.validUntil ? (
            <div className="card-surface rounded-xl border border-border bg-surface p-4 text-sm">
              <div className="text-xs text-muted">Valid until</div>
              <div className="mt-0.5 font-medium text-fg">{p.validUntil}</div>
            </div>
          ) : null}

          {versions.length > 0 ? (
            <div className="card-surface rounded-xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold text-fg">Issued versions</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-baseline justify-between gap-2">
                    <span>
                      <VersionTag label={v.versionLabel} />
                      <span className="ml-1.5 text-xs text-muted">{v.createdAt.slice(0, 10)}</span>
                      {v.createdByName ? <span className="text-xs text-faint"> · {v.createdByName}</span> : null}
                    </span>
                    <span className="tabular-nums text-muted">{formatCurrency(v.grandTotal, v.currency, { maximumFractionDigits: 0 })}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t border-border pt-2 text-xs text-muted">
                Each issued version is an immutable snapshot of what the client received.
              </p>
            </div>
          ) : null}

          {history.length > 0 ? (
            <div className="card-surface rounded-xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold text-fg">Status history</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="text-muted">
                    <span className="text-fg">{STATUS_LABEL[h.toStatus]}</span>
                    <span className="ml-1.5 text-xs">{h.createdAt.slice(0, 10)}</span>
                    {h.byName ? <span className="text-xs text-faint"> · {h.byName}</span> : null}
                    {h.reason ? <div className="text-xs text-faint">{h.reason}</div> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-muted">
      <dt>{k}</dt>
      <dd className="tabular-nums text-fg">{v}</dd>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted">{label}</div>
      <p className="mt-0.5 whitespace-pre-wrap text-fg">{value}</p>
    </div>
  );
}
