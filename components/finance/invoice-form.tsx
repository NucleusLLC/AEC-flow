"use client";

/**
 * The invoice editor: who is billed, what for, and what it adds up to.
 *
 * THE TOTALS ARE COMPUTED HERE BY THE SAME FUNCTION THE SERVER STORES. Every
 * figure on this screen comes from `invoiceTotals` in lib/finance/calc.ts, in
 * exact minor units, so the number the user sees while typing is the number
 * that lands in the database and the number the client is asked to pay.
 *
 * MILESTONE LINES CARRY THEIR ORIGIN. A line raised from a proposal's payment
 * milestone keeps `milestoneId`, which is what stops the same milestone being
 * billed twice — the "raise from proposal" screen reads it back.
 */

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { currencyOptions, formatCurrency, getSystemCurrency } from "@/lib/format";
import { dueDateFrom, invoiceTotals, lineAmount } from "@/lib/finance/calc";
import type { InvoiceDTO, InvoiceInput, InvoiceLineInput, TaxMode } from "@/lib/finance/types";
import { createInvoiceAction, updateInvoiceAction } from "@/app/(app)/finance/invoices/actions";

const field =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const input = `h-9 ${field} py-0`;
const label = "mb-1 block text-xs font-medium text-muted";

export type PickerOption = { id: string; name: string };

type EditableLine = InvoiceLineInput & { key: string };

let seq = 0;
const nextKey = () => `line-${++seq}`;

export function InvoiceForm({
  mode,
  initial,
  clients,
  projects,
  /** Prefill from a proposal's milestones — see /finance/invoices/new. */
  prefill,
  today,
}: {
  mode: "new" | "edit";
  initial?: InvoiceDTO;
  clients: PickerOption[];
  projects: PickerOption[];
  prefill?: Partial<InvoiceInput> & { lines?: InvoiceLineInput[] };
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const source = initial ?? prefill;
  const [currency, setCurrency] = useState(source?.currency ?? getSystemCurrency());
  const [clientId, setClientId] = useState(source?.clientId ?? "");
  const [clientName, setClientName] = useState(source?.clientName ?? "");
  const [contactName, setContactName] = useState(source?.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(source?.contactEmail ?? "");
  const [billingAddress, setBillingAddress] = useState(source?.billingAddress ?? "");
  const [projectId, setProjectId] = useState(source?.projectId ?? "");
  const [title, setTitle] = useState(source?.title ?? "");
  const [intro, setIntro] = useState(source?.intro ?? "");
  const [issueDate, setIssueDate] = useState(source?.issueDate ?? today);
  const [termsDays, setTermsDays] = useState(String(source?.termsDays ?? 30));
  const [dueDate, setDueDate] = useState(source?.dueDate ?? dueDateFrom(today, 30) ?? "");
  const [taxName, setTaxName] = useState(source?.taxName ?? "");
  const [taxPercent, setTaxPercent] = useState(String(source?.taxPercent ?? 0));
  const [taxMode, setTaxMode] = useState<TaxMode>(source?.taxMode ?? "EXCLUSIVE");
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [footer, setFooter] = useState(source?.footer ?? "");
  const [lines, setLines] = useState<EditableLine[]>(() => {
    const from = initial?.lines ?? prefill?.lines ?? [];
    if (from.length === 0) {
      return [{ key: nextKey(), description: "", amount: 0, taxable: true }];
    }
    return from.map((l) => ({
      key: nextKey(),
      description: l.description,
      milestoneId: l.milestoneId ?? null,
      milestoneName: l.milestoneName ?? null,
      quantity: l.quantity ?? null,
      unitRate: l.unitRate ?? null,
      amount: l.amount,
      taxable: l.taxable ?? true,
    }));
  });

  const client = clients.find((c) => c.id === clientId);
  const project = projects.find((p) => p.id === projectId);

  const totals = useMemo(
    () => invoiceTotals(lines, { percent: Number(taxPercent) || 0, mode: taxMode }, currency),
    [lines, taxPercent, taxMode, currency],
  );
  const money = (n: number) =>
    formatCurrency(n, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function patchLine(key: string, patch: Partial<EditableLine>) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        // A quantity and a rate together drive the amount; typing an amount
        // directly still wins, because that is how a fee line is usually billed.
        if (("quantity" in patch || "unitRate" in patch) && next.quantity !== null && next.unitRate !== null) {
          next.amount = lineAmount(next.quantity ?? null, next.unitRate ?? null, currency);
        }
        return next;
      }),
    );
  }

  function save() {
    setError(null);
    const payload: InvoiceInput = {
      currency,
      clientId: clientId || null,
      clientName: client?.name ?? clientName,
      contactName: contactName || null,
      contactEmail: contactEmail || null,
      billingAddress: billingAddress || null,
      projectId: projectId || null,
      projectName: project?.name ?? initial?.projectName ?? prefill?.projectName ?? null,
      serviceProposalId: source?.serviceProposalId ?? null,
      proposalNumber: source?.proposalNumber ?? null,
      title: title || null,
      intro: intro || null,
      issueDate: issueDate || null,
      dueDate: dueDate || null,
      termsDays: termsDays === "" ? null : Number(termsDays),
      taxName: taxName || null,
      taxPercent: Number(taxPercent) || 0,
      taxMode,
      notes: notes || null,
      footer: footer || null,
      // The editor key is local bookkeeping, not part of the line.
      lines: lines.map((l) => ({
        description: l.description,
        milestoneId: l.milestoneId ?? null,
        milestoneName: l.milestoneName ?? null,
        quantity: l.quantity ?? null,
        unitRate: l.unitRate ?? null,
        amount: l.amount,
        taxable: l.taxable ?? true,
      })),
    };
    start(async () => {
      const res =
        mode === "edit" && initial
          ? await updateInvoiceAction(initial.id, payload)
          : await createInvoiceAction(payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/finance/invoices/${res.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Billed to" subtitle="Copied onto the invoice — a client renamed later does not rewrite it." />
        <CardBody className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={label}>Client</label>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                const picked = clients.find((c) => c.id === e.target.value);
                if (picked) setClientName(picked.name);
              }}
              className={input}
            >
              <option value="">— type a name instead —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Billed to *</label>
            <input
              value={client?.name ?? clientName}
              onChange={(e) => setClientName(e.target.value)}
              disabled={Boolean(client)}
              placeholder="Who the invoice is addressed to"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Attention of</label>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Their email</label>
            <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={input}>
              <option value="">— none —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <label className={label}>Billing address</label>
            <input value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} className={input} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="The invoice"
          subtitle={
            source?.proposalNumber
              ? `Raised from proposal ${source.proposalNumber}.`
              : "Dates, terms and the currency this invoice is in."
          }
        />
        <CardBody className="grid gap-4 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={label}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Architectural services — stage 2"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={input}>
              {currencyOptions(["AWG", "USD", "ANG", "EUR"]).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={label}>Invoice date</label>
            <input
              type="date"
              value={issueDate}
              onChange={(e) => {
                setIssueDate(e.target.value);
                const days = Number(termsDays);
                if (Number.isFinite(days)) setDueDate(dueDateFrom(e.target.value, days) ?? "");
              }}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Terms (days)</label>
            <input
              type="number"
              value={termsDays}
              onChange={(e) => {
                setTermsDays(e.target.value);
                const days = Number(e.target.value);
                if (Number.isFinite(days)) setDueDate(dueDateFrom(issueDate, days) ?? "");
              }}
              className={input}
            />
          </div>
          <div>
            <label className={label}>Due</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Introduction</label>
            <input
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="What this invoice covers, in the client's terms"
              className={input}
            />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Lines" subtitle="An amount, or a quantity and a rate that produce one." />
        <CardBody className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="px-2 pb-1.5 font-medium">Description</th>
                  <th className="px-2 pb-1.5 font-medium">Qty</th>
                  <th className="px-2 pb-1.5 font-medium">Rate</th>
                  <th className="px-2 pb-1.5 text-right font-medium">Amount</th>
                  <th className="px-2 pb-1.5 text-center font-medium">Tax</th>
                  <th className="px-2 pb-1.5" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.key} className="border-t border-border/60 align-top">
                    <td className="px-2 py-2">
                      <input
                        value={l.description}
                        onChange={(e) => patchLine(l.key, { description: e.target.value })}
                        placeholder="What is being billed"
                        className={input}
                      />
                      {l.milestoneName ? (
                        <div className="mt-1 text-[11px] text-faint">Milestone: {l.milestoneName}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 w-24">
                      <input
                        type="number"
                        value={l.quantity ?? ""}
                        onChange={(e) =>
                          patchLine(l.key, { quantity: e.target.value === "" ? null : Number(e.target.value) })
                        }
                        className={input}
                      />
                    </td>
                    <td className="px-2 py-2 w-32">
                      <input
                        type="number"
                        step="0.01"
                        value={l.unitRate ?? ""}
                        onChange={(e) =>
                          patchLine(l.key, { unitRate: e.target.value === "" ? null : Number(e.target.value) })
                        }
                        className={input}
                      />
                    </td>
                    <td className="px-2 py-2 w-36">
                      <input
                        type="number"
                        step="0.01"
                        value={l.amount}
                        onChange={(e) => patchLine(l.key, { amount: Number(e.target.value) || 0 })}
                        className={`${input} text-right font-mono`}
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={l.taxable !== false}
                        onChange={(e) => patchLine(l.key, { taxable: e.target.checked })}
                        aria-label="Taxable"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setLines((ls) => (ls.length === 1 ? ls : ls.filter((x) => x.key !== l.key)))}
                        aria-label="Remove line"
                        className="text-faint transition-colors hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() =>
              setLines((ls) => [...ls, { key: nextKey(), description: "", amount: 0, taxable: true }])
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Plus className="h-4 w-4" /> Add a line
          </button>
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Tax" subtitle="Snapshotted onto this invoice, not joined to a rate that may change." />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className={label}>Name</label>
              <input
                value={taxName}
                onChange={(e) => setTaxName(e.target.value)}
                placeholder="BBO"
                className={input}
              />
            </div>
            <div>
              <label className={label}>Percent</label>
              <input
                type="number"
                step="0.01"
                value={taxPercent}
                onChange={(e) => setTaxPercent(e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label className={label}>Applied</label>
              <select value={taxMode} onChange={(e) => setTaxMode(e.target.value as TaxMode)} className={input}>
                <option value="EXCLUSIVE">Added on top</option>
                <option value="INCLUSIVE">Already in the amounts</option>
              </select>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Totals" subtitle="The same arithmetic the server stores." />
          <CardBody className="space-y-1 text-sm">
            <Row label="Subtotal" value={money(totals.subtotal)} />
            {Number(taxPercent) > 0 ? (
              <>
                <Row label="Taxable" value={money(totals.taxableSubtotal)} muted />
                <Row
                  label={`${taxName || "Tax"} ${Number(taxPercent)}%${taxMode === "INCLUSIVE" ? " (included)" : ""}`}
                  value={money(totals.taxTotal)}
                />
              </>
            ) : null}
            <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
              <span className="font-medium text-fg">Total</span>
              <span className="font-mono text-lg font-semibold tabular-nums text-fg">
                {money(totals.total)}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Notes and footer" subtitle="The footer prints under the total — terms, bank details." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Internal notes</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Printed footer</label>
            <textarea rows={3} value={footer} onChange={(e) => setFooter(e.target.value)} className={field} />
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : mode === "edit" ? "Save draft" : "Create draft"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-fg hover:bg-surface-2"
        >
          Cancel
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function Row({ label: l, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={muted ? "text-faint" : "text-muted"}>{l}</span>
      <span className={`font-mono tabular-nums ${muted ? "text-faint" : "text-fg"}`}>{value}</span>
    </div>
  );
}
