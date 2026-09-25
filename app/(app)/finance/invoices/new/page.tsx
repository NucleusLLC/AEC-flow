import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Clock, FileSignature } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { InvoiceForm } from "@/components/finance/invoice-form";
import { getProposalBilling, listBillableProposals } from "@/lib/data/invoices";
import { projectsWithUnbilledWork, unbilledWork } from "@/lib/data/work-billing";
import { UnbilledWorkPicker } from "@/components/finance/unbilled-work-picker";
import { getClients } from "@/lib/data/clients";
import { getProjects } from "@/lib/data/projects";
import { dueDateFrom } from "@/lib/finance/calc";
import { ymd } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";
import type { InvoiceLineInput } from "@/lib/finance/types";

export const metadata: Metadata = { title: "New invoice · AEC-flow" };

/**
 * Raise an invoice — from an accepted proposal's payment milestones, or from
 * scratch.
 *
 * The milestone list shows what each one is worth, what has already been billed
 * against it and what is left, because "bill stage 2" is a question about the
 * proposal's history, not just its schedule. A proposal whose milestones do not
 * add up to 100% says so here rather than quietly under-billing.
 */
export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ proposal?: string; milestones?: string; work?: string }>;
}) {
  const [{ proposal: proposalId, milestones: picked, work: workProjectId }, clients, projects, proposals] =
    await Promise.all([searchParams, getClients(), getProjects(), listBillableProposals()]);

  const today = ymd(new Date());
  const billing = proposalId ? await getProposalBilling(proposalId) : null;
  const chosen = new Set((picked ?? "").split(",").filter(Boolean));

  const clientOptions = clients.map((c) => ({ id: c.id, name: c.name }));
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));

  // Step 2: a proposal is chosen and milestones ticked — go straight to the form.
  if (billing && chosen.size > 0) {
    const lines: InvoiceLineInput[] = billing.milestones
      .filter((m) => chosen.has(m.id) && m.remaining > 0)
      .map((m) => ({
        description: m.name,
        milestoneId: m.id,
        milestoneName: m.name,
        amount: m.remaining,
        taxable: true,
      }));

    return (
      <div className="w-full space-y-6">
        <Link
          href={`/finance/invoices/new?proposal=${billing.serviceProposalId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          Choose different milestones
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-fg">
            Invoice from {billing.proposalNumber}
          </h2>
          <p className="text-sm text-muted">
            {lines.length} milestone{lines.length === 1 ? "" : "s"} · {billing.title}
          </p>
        </div>
        <InvoiceForm
          mode="new"
          clients={clientOptions}
          projects={projectOptions}
          today={today}
          prefill={{
            currency: billing.currency,
            clientId: billing.clientId,
            clientName: billing.clientName,
            contactName: billing.contactName,
            contactEmail: billing.contactEmail,
            projectId: billing.projectId,
            projectName: billing.projectName,
            serviceProposalId: billing.serviceProposalId,
            proposalNumber: billing.proposalNumber,
            title: billing.title,
            taxName: billing.taxName,
            taxPercent: billing.taxPercent,
            taxMode: billing.taxMode,
            issueDate: today,
            termsDays: 30,
            dueDate: dueDateFrom(today, 30),
            lines,
          }}
        />
      </div>
    );
  }

  // Step 2 (work): a project is chosen — pick which of its unbilled lines to
  // bill. Both groupings are loaded so the "one line for all time" toggle is
  // instant and, more importantly, so the client never re-groups the figures
  // itself: every amount on that screen came from the server's own arithmetic.
  if (workProjectId) {
    const [detail, summary] = await Promise.all([
      unbilledWork({ projectId: workProjectId }),
      unbilledWork({ projectId: workProjectId, summarise: true }),
    ]);

    return (
      <div className="w-full max-w-4xl space-y-6">
        <Link
          href="/finance/invoices/new"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          Choose a different job
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-fg">{detail.projectName}</h2>
          <p className="text-sm text-muted">
            {detail.clientName || "No client on this job"} · {detail.totalHours.toFixed(2)} hours and{" "}
            {formatCurrency(detail.total, detail.currency, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            waiting to be billed
          </p>
        </div>
        <UnbilledWorkPicker
          work={{
            projectId: workProjectId,
            projectName: detail.projectName,
            currency: detail.currency,
            detailed: detail.lines,
            summarised: summary.lines,
            totalHours: detail.totalHours,
            excluded: detail.excluded,
          }}
        />
      </div>
    );
  }

  // Step 1b: a proposal is chosen — pick the milestones to bill.
  if (billing) {
    const money = (n: number) =>
      formatCurrency(n, billing.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const billable = billing.milestones.filter((m) => m.remaining > 0);

    return (
      <div className="w-full max-w-4xl space-y-6">
        <Link
          href="/finance/invoices/new"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          Choose a different proposal
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-fg">{billing.proposalNumber}</h2>
          <p className="text-sm text-muted">
            {billing.title} · {billing.clientName} · {money(billing.grandTotal)}
          </p>
        </div>

        {billing.warnings.map((w) => (
          <p
            key={w}
            className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-fg"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            {w}
          </p>
        ))}

        <Card>
          <CardHeader
            title="Payment milestones"
            subtitle="Tick what this invoice bills. What has already been invoiced is shown against each one."
          />
          <CardBody>
            {/* A GET form: the choice travels in the URL, so the page that
              * renders the invoice form is reachable, refreshable and linkable
              * rather than hidden behind client state. */}
            <form method="GET" className="space-y-3">
              <input type="hidden" name="proposal" value={billing.serviceProposalId} />
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                    <th className="pb-1.5" />
                    <th className="pb-1.5 font-medium">Milestone</th>
                    <th className="pb-1.5 text-right font-medium">Value</th>
                    <th className="pb-1.5 text-right font-medium">Invoiced</th>
                    <th className="pb-1.5 text-right font-medium">Left to bill</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.milestones.map((m) => (
                    <tr key={m.id} className="border-t border-border/60">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          name="milestones"
                          value={m.id}
                          disabled={m.remaining <= 0}
                          defaultChecked={m.remaining > 0 && billable.length === 1}
                          aria-label={`Bill ${m.name}`}
                        />
                      </td>
                      <td className="py-2">
                        <div className="text-fg">{m.name}</div>
                        <div className="text-[11px] text-faint">
                          {m.percent}%{m.trigger ? ` · ${m.trigger}` : ""}
                          {m.invoiceNumbers.length > 0 ? ` · on ${m.invoiceNumbers.join(", ")}` : ""}
                        </div>
                      </td>
                      <td className="py-2 text-right font-mono tabular-nums text-fg">{money(m.amount)}</td>
                      <td className="py-2 text-right font-mono tabular-nums text-muted">
                        {m.invoiced > 0 ? money(m.invoiced) : "—"}
                      </td>
                      <td className="py-2 text-right font-mono font-semibold tabular-nums text-fg">
                        {m.remaining > 0 ? money(m.remaining) : "billed"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {billable.length === 0 ? (
                <p className="text-sm text-muted">
                  Every milestone on this proposal has been invoiced. Voiding an invoice frees its
                  milestones again.
                </p>
              ) : (
                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
                >
                  Continue with the ticked milestones
                </button>
              )}
            </form>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Step 1a: choose a proposal, a job with unbilled work, or write one from
  // scratch.
  const withWork = await projectsWithUnbilledWork();

  return (
    <div className="w-full max-w-4xl space-y-6">
      <Link
        href="/finance/invoices"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        Invoices
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">New invoice</h2>
        <p className="text-sm text-muted">
          From an accepted proposal, so the amounts and the tax come across — or from scratch.
        </p>
      </div>

      <Card>
        <CardHeader
          title="From an accepted proposal"
          subtitle="Its payment milestones become the invoice lines."
        />
        <CardBody>
          {proposals.length === 0 ? (
            <p className="text-sm text-muted">
              No proposal has been accepted yet. Invoices raised from a proposal carry its client,
              currency, tax and milestone amounts across; until then, write one from scratch below.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {proposals.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/finance/invoices/new?proposal=${p.id}`}
                    className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileSignature className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-fg">
                          <span className="font-mono">{p.number}</span> · {p.title}
                        </span>
                        <span className="block truncate text-[11px] text-faint">
                          {p.clientName ?? "No client"} · {p.status}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-fg">
                      {formatCurrency(p.grandTotal, p.currency, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="From time and expenses"
          subtitle="Approved, billable work that has not reached an invoice. Oldest first — that is the money that has been waiting longest."
        />
        <CardBody>
          {withWork.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing is waiting to be billed. Hours and expenses appear here once they are marked
              billable and approved.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {withWork.map((w) => (
                <li key={`${w.projectId}:${w.currency}`}>
                  <Link
                    href={`/finance/invoices/new?work=${w.projectId}`}
                    className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0 text-muted" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-fg">
                          {w.projectName}
                        </span>
                        <span className="block truncate text-[11px] text-faint">
                          {w.hours > 0 ? `${w.hours.toFixed(2)} hours · ` : ""}
                          {w.oldest ? `oldest ${w.oldest}` : "expenses only"}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-fg">
                      {formatCurrency(w.total, w.currency, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="From scratch" subtitle="For anything the practice never quoted." />
        <CardBody>
          <InvoiceForm
            mode="new"
            clients={clientOptions}
            projects={projectOptions}
            today={today}
            prefill={{ issueDate: today, termsDays: 30, dueDate: dueDateFrom(today, 30) }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
