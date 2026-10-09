"use client";

/**
 * The overdue chase list: one card per client per currency, most overdue
 * first, each with a "Copy reminder" for the whole client and one per invoice.
 *
 * The grouping, the sums and the reminder's wording are lib/finance/overdue.ts
 * (pure, tested); this file only lays them out and puts text on the clipboard.
 * Nothing is sent: the reminder is for a person to paste into an email or a
 * WhatsApp message, read, and adjust.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, PartyPopper } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";
import { OverdueBadge } from "@/components/finance/badges";
import { militaryDate } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";
import {
  overdueChase,
  reminderText,
  type ChaseGroup,
  type ChaseInvoiceInput,
} from "@/lib/finance/overdue";

function money(n: number, currency: string): string {
  return formatCurrency(n, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Clipboard API where it exists; a hidden textarea where it does not (http, old WebViews). */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function OverdueChaseView({
  invoices,
  today,
  sender,
}: {
  invoices: ChaseInvoiceInput[];
  today: string;
  sender: string;
}) {
  const t = useT();
  const { groups, totals } = useMemo(() => overdueChase(invoices, today), [invoices, today]);
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  async function copy(id: string, group: ChaseGroup, only?: string[]) {
    const text = reminderText(group, { t, money, date: militaryDate, sender }, only);
    const ok = await copyText(text);
    if (ok) {
      setFailed(null);
      setCopied(id);
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    } else {
      setFailed(text);
    }
  }

  if (groups.length === 0) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center py-12 text-center">
          <PartyPopper className="h-8 w-8 text-faint" />
          <p className="mt-3 text-sm font-medium text-fg">{t("Nothing is overdue.")}</p>
          <p className="mt-1 text-sm text-muted">
            {t("Every issued invoice is either paid or not yet due.")}
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map((x) => (
          <Card key={x.currency}>
            <CardBody className="py-3">
              <div className="text-[11px] uppercase tracking-wide text-faint">
                {fmt(t("Overdue in {currency}"), { currency: x.currency })}
              </div>
              <div className="mt-1 font-mono text-lg font-semibold tabular-nums text-fg">
                {money(x.outstanding, x.currency)}
              </div>
              <div className="text-[11px] text-faint">
                {fmt(t("{invoices} invoices · {clients} clients"), {
                  invoices: x.invoices,
                  clients: x.clients,
                })}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {failed ? (
        <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-sm text-fg">
            {t("This browser would not copy to the clipboard. Select the text below and copy it yourself.")}
          </p>
          <textarea
            readOnly
            value={failed}
            rows={10}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border border-border bg-surface p-2 font-mono text-xs text-fg"
          />
        </div>
      ) : null}

      {groups.map((g) => (
        <Card key={g.key}>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-fg">
                  {g.clientId ? (
                    <Link href={`/clients/${g.clientId}`} className="hover:text-brand hover:underline">
                      {g.clientName}
                    </Link>
                  ) : (
                    g.clientName
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <span className="font-mono tabular-nums text-fg">{money(g.outstanding, g.currency)}</span>
                  <span>
                    {g.invoices.length === 1
                      ? t("1 invoice overdue")
                      : fmt(t("{count} invoices overdue"), { count: g.invoices.length })}
                  </span>
                  <OverdueBadge days={g.maxDaysOverdue} />
                </div>
              </div>
              <CopyButton
                copied={copied === g.key}
                onClick={() => void copy(g.key, g)}
                label={g.invoices.length === 1 ? t("Copy reminder") : t("Copy reminder for all")}
                primary
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                    <th className="pb-1.5 pr-3 font-medium">{t("Invoice")}</th>
                    <th className="px-3 pb-1.5 font-medium">{t("Project")}</th>
                    <th className="px-3 pb-1.5 font-medium">{t("Due")}</th>
                    <th className="px-3 pb-1.5 font-medium">{t("Overdue")}</th>
                    <th className="px-3 pb-1.5 text-right font-medium">{t("Outstanding")}</th>
                    <th className="pb-1.5 pl-3" />
                  </tr>
                </thead>
                <tbody>
                  {g.invoices.map((i) => (
                    <tr key={i.id} className="border-t border-border/60">
                      <td className="py-2 pr-3 align-middle">
                        <Link
                          href={`/finance/invoices/${i.id}`}
                          className="font-mono text-xs font-medium text-brand hover:underline"
                        >
                          {i.number}
                        </Link>
                      </td>
                      <td className="px-3 py-2 align-middle text-muted">{i.projectName ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 align-middle font-mono text-xs tabular-nums text-muted">
                        {militaryDate(i.dueDate)}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <OverdueBadge days={i.daysOverdue} />
                      </td>
                      <td className="px-3 py-2 text-right align-middle font-mono tabular-nums text-fg">
                        {money(i.outstanding, g.currency)}
                      </td>
                      <td className="py-2 pl-3 text-right align-middle">
                        {g.invoices.length > 1 ? (
                          <CopyButton
                            copied={copied === i.id}
                            onClick={() => void copy(i.id, g, [i.id])}
                            label={t("Copy reminder")}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

function CopyButton({
  copied,
  onClick,
  label,
  primary,
}: {
  copied: boolean;
  onClick: () => void;
  label: string;
  primary?: boolean;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? "inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-brand-fg transition-colors hover:bg-brand/90"
          : "inline-flex h-7 items-center gap-1.5 rounded-lg border border-border px-2 text-[11px] text-muted hover:bg-surface-2 hover:text-fg"
      }
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? t("Copied") : label}
    </button>
  );
}
