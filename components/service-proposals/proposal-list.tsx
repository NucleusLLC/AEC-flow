"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileSignature } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { add, fromMajor, toMajor } from "@/lib/proposals/engine/money";
import { ServiceProposalStatusBadge } from "@/components/service-proposals/status-badge";
import { VersionTag } from "@/components/service-proposals/version-tag";
import { STATUS_LABEL, type ServiceProposalStatus } from "@/lib/proposals/engine/status";
import type { ServiceProposalListItem } from "@/lib/proposals/dto";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";

const STATUSES = Object.keys(STATUS_LABEL) as ServiceProposalStatus[];

export function ServiceProposalList({ proposals }: { proposals: ServiceProposalListItem[] }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<ServiceProposalStatus | "ALL">("ALL");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return proposals.filter((p) => {
      if (status !== "ALL" && p.status !== status) return false;
      if (!needle) return true;
      return (
        p.number.toLowerCase().includes(needle) ||
        p.title.toLowerCase().includes(needle) ||
        (p.clientName ?? "").toLowerCase().includes(needle) ||
        (p.projectName ?? "").toLowerCase().includes(needle)
      );
    });
  }, [proposals, q, status]);

  if (proposals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
        <FileSignature className="h-8 w-8 text-faint" />
        <p className="mt-3 text-sm font-medium text-fg">{t("No service proposals yet")}</p>
        <p className="mt-1 text-sm text-muted">
          {t("Create your first fee proposal — percentage of construction cost, or a fixed fee.")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("Search number, title, client, project…")}
            className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-3 text-sm text-fg placeholder:text-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ServiceProposalStatus | "ALL")}
          className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
        >
          <option value="ALL">{t("All statuses")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(STATUS_LABEL[s])}</option>)}
        </select>
      </div>

      <div className="card-surface overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/40 text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-medium">{t("Number")}</th>
              <th className="px-4 py-2.5 font-medium">{t("Title")}</th>
              <th className="px-4 py-2.5 font-medium">{t("Client")}</th>
              <th className="px-4 py-2.5 font-medium">{t("Basis")}</th>
              <th className="px-4 py-2.5 font-medium">{t("Status")}</th>
              <th className="px-4 py-2.5 text-right font-medium">{t("Total fee")}</th>
              {/* The turnover tax inside those fees. Here because the question
                * the accounting side asks of this page is "what BBO is payable",
                * and answering it from each proposal one at a time is how a
                * month's figure comes to be wrong. */}
              <th className="px-4 py-2.5 text-right font-medium">{t("BBO incl.")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-surface-2/30">
                <td className="px-4 py-2.5">
                  <Link href={`/design/service-proposals/${p.id}`} className="font-medium text-brand hover:underline">
                    {p.number}
                  </Link>
                  {p.revision > 1 ? <span className="ml-1.5 text-xs text-faint">{fmt(t("rev {n}"), { n: p.revision })}</span> : null}
                  <VersionTag label={p.versionLabel} className="ml-1.5 text-xs" />
                </td>
                <td className="px-4 py-2.5 text-fg">{p.title}</td>
                <td className="px-4 py-2.5 text-muted">{p.clientName ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted">{t(p.feeBasisLabel ?? "Fixed fee")}</td>
                <td className="px-4 py-2.5"><ServiceProposalStatusBadge status={p.status} /></td>
                <td className="px-4 py-2.5 text-right tabular-nums text-fg">
                  {formatCurrency(p.grandTotal, p.currency, { maximumFractionDigits: 2 })}
                </td>
                <td
                  className="px-4 py-2.5 text-right tabular-nums text-muted"
                  title={fmt(t(p.bboIncluded ? "{pct}% included in the price" : "{pct}% added to the price"), { pct: p.bboPercent })}
                >
                  {formatCurrency(p.bboAmount, p.currency, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-muted">{t("No proposals match your filters.")}</td></tr>
            ) : null}
          </tbody>
          {filtered.length > 0 ? (
            <tfoot>
              {/* One row per currency: a total across currencies is a number
                * with no meaning, and this one is read to pay a tax bill. */}
              {bboByCurrency(filtered).map((tot) => (
                <tr key={tot.currency} className="border-t-2 border-border bg-surface-2/40">
                  <td className="px-4 py-2.5 font-medium text-fg" colSpan={5}>
                    {fmt(t(tot.count === 1 ? "1 proposal in {currency}" : "{count} proposals in {currency}"), {
                      count: tot.count,
                      currency: tot.currency,
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-fg">
                    {formatCurrency(tot.fees, tot.currency, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-fg">
                    {formatCurrency(tot.bbo, tot.currency, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              ))}
            </tfoot>
          ) : null}
        </table>
      </div>

      <p className="text-xs text-faint">
        {t(
          "BBO shown is the turnover tax contained in each fee — the prices include it. The totals row is what those proposals carry in tax, per currency; a proposal becomes payable as its instalments are invoiced.",
        )}
      </p>
    </div>
  );
}

/**
 * The fees and the contained BBO, grouped by currency and summed to the cent.
 *
 * Exact money, because this row is read to pay a tax bill: see
 * lib/proposals/bbo.ts and the engine's money primitive underneath it.
 */
function bboByCurrency(
  rows: { currency: string; grandTotal: number; bboAmount: number }[],
): { currency: string; count: number; fees: number; bbo: number }[] {
  const by = new Map<string, { currency: string; count: number; fees: number; bbo: number }>();
  for (const r of rows) {
    const entry = by.get(r.currency) ?? { currency: r.currency, count: 0, fees: 0, bbo: 0 };
    entry.count += 1;
    entry.fees = toMajor(add(fromMajor(entry.fees, r.currency), fromMajor(r.grandTotal, r.currency)));
    entry.bbo = toMajor(add(fromMajor(entry.bbo, r.currency), fromMajor(r.bboAmount, r.currency)));
    by.set(r.currency, entry);
  }
  return [...by.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}
