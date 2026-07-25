import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import { getServiceProposal } from "@/lib/data/service-proposals";
import { computeProposal } from "@/lib/proposals/engine/engine";
import type { ProposalCalcInput } from "@/lib/proposals/engine/types";
import { isLocked } from "@/lib/proposals/engine/status";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ServiceProposalStatusBadge } from "@/components/service-proposals/status-badge";
import { ServiceProposalActions } from "@/components/service-proposals/proposal-actions";
import { formatCurrency } from "@/lib/format";

export const metadata: Metadata = { title: "Service Proposal · AEC-flow" };

export default async function ServiceProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await getServiceProposal(id);
  if (!p) notFound();

  const calc = computeProposal(p.input as ProposalCalcInput);
  const money = (n: number) => formatCurrency(n, p.currency, { maximumFractionDigits: 2 });
  const locked = isLocked(p.status);

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
          </div>
          <p className="mt-1 font-mono text-sm text-muted">
            {p.number}{p.revision > 1 ? ` · rev ${p.revision}` : ""}
            {p.clientName ? ` · ${p.clientName}` : ""}
            {p.projectName ? ` · ${p.projectName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!locked ? (
            <Link href={`/design/service-proposals/${p.id}/edit`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-muted hover:border-brand hover:text-fg">
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          ) : null}
          <Link href={`/print/service-proposals/${p.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-muted hover:border-brand hover:text-fg">
            <Printer className="h-4 w-4" /> Document
          </Link>
        </div>
      </div>

      <ServiceProposalActions id={p.id} status={p.status} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
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
                  <tbody>
                    {calc.paymentSchedule.map((m) => (
                      <tr key={m.id} className="border-b border-border/60 last:border-0">
                        <td className="py-2 text-fg">{m.name}</td>
                        <td className="py-2 text-right tabular-nums text-muted">{m.percent}%</td>
                        <td className="py-2 text-right tabular-nums text-fg">{money(m.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
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
          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="text-sm font-semibold text-fg">Totals</h3>
            <dl className="mt-3 space-y-1.5 text-sm">
              <Row k="Base fee" v={money(calc.totals.baseFeeTotal)} />
              {calc.totals.optionalSelectedTotal > 0 ? <Row k="Optional (selected)" v={money(calc.totals.optionalSelectedTotal)} /> : null}
              {calc.totals.reimbursablesTotal > 0 ? <Row k="Reimbursables" v={money(calc.totals.reimbursablesTotal)} /> : null}
              <Row k="Subtotal" v={money(calc.totals.subtotal)} />
              {calc.totals.discountTotal > 0 ? <Row k="Discount" v={`− ${money(calc.totals.discountTotal)}`} /> : null}
              {calc.totals.taxTotal > 0 ? <Row k="Tax" v={money(calc.totals.taxTotal)} /> : null}
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
            <div className="rounded-xl border border-border bg-surface p-4 text-sm">
              <div className="text-xs text-muted">Valid until</div>
              <div className="mt-0.5 font-medium text-fg">{p.validUntil}</div>
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
