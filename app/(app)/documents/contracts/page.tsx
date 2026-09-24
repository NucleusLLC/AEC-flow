import type { Metadata } from "next";
import Link from "next/link";
import { FileSignature, Plus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listContracts } from "@/lib/data/contracts";
import { CONTRACT_STATUS_LABEL, CONTRACT_STATUS_TONE, type ContractStatus } from "@/lib/contracts/types";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Contracts · AEC-flow" };

const money = (n: number, currency: string) =>
  `${currency} ${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function ContractsPage() {
  const contracts = await listContracts();

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-fg">Construction contracts</h2>
          <p className="text-sm text-muted">
            The practice&apos;s own contract, filled in for a job — and what has been issued and signed.
          </p>
        </div>
        <Link
          href="/documents/contracts/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" /> New contract
        </Link>
      </div>

      {contracts.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-faint">
              <FileSignature className="h-6 w-6" />
            </div>
            <p className="mt-4 text-sm font-medium text-fg">No contracts yet.</p>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
              Upload the contract this practice uses, enter a job&apos;s particulars, and the same
              contract comes back filled in — the wording untouched, the figures exact, typeset on
              your letterhead.
            </p>
            <Link
              href="/documents/contracts/new"
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
            >
              <Plus className="h-4 w-4" /> Make the first one
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="overflow-x-auto pb-1">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                <th className="px-4 pb-1.5 font-medium">Contract</th>
                <th className="px-3 pb-1.5 font-medium">Project</th>
                <th className="px-3 pb-1.5 font-medium">Parties</th>
                <th className="px-3 pb-1.5 text-right font-medium">Sum</th>
                <th className="px-3 pb-1.5 font-medium">Dated</th>
                <th className="px-4 pb-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border/60 transition-colors last:border-0 even:bg-surface-2/40 hover:bg-surface-2"
                >
                  <td className="px-4 py-2.5 align-top">
                    <Link
                      href={`/documents/contracts/${c.id}`}
                      className="font-mono text-xs font-semibold text-brand hover:underline"
                    >
                      {c.number}
                    </Link>
                    {c.templateName ? (
                      <div className="truncate text-[11px] text-faint">{c.templateName}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 align-top">
                    <div className="truncate font-medium text-fg">{c.projectName}</div>
                    {c.projectNumber ? (
                      <div className="font-mono text-[11px] text-faint">{c.projectNumber}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 align-top text-muted">
                    <div className="truncate">{c.employerName}</div>
                    <div className="truncate text-[11px] text-faint">{c.contractorName}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right align-top font-mono tabular-nums text-fg">
                    {money(c.contractSum, c.currency)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 align-top font-mono text-xs tabular-nums text-muted">
                    {formatDate((c.issuedAt ?? c.createdAt).slice(0, 10))}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <Badge tone={CONTRACT_STATUS_TONE[c.status as ContractStatus]}>
                      {CONTRACT_STATUS_LABEL[c.status as ContractStatus]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
