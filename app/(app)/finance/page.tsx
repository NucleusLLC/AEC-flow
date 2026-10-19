import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Download,
  FilePen,
  HandCoins,
  Plus,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile, StatSection } from "@/components/modules/stat-tile";
import { listInvoices, listInvoicesOnBooks } from "@/lib/data/invoices";
import { getSystemCurrency } from "@/lib/server/practice-config";
import { financeHubTiles, type HubPayment } from "@/lib/finance/hub";
import { INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE } from "@/lib/finance/types";
import {
  CREDIT_NOTES_ITEM,
  EXPENSES_ITEM,
  INVOICES_ITEM,
  PROFIT_ITEM,
  RECEIVABLES_ITEM,
  TAX_ITEM,
  TIME_ITEM,
  type NavItem,
} from "@/lib/nav";
import { militaryDate, ymd } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Finance")} · AEC-flow` };
}

/** How many of the latest invoices the overview lists. */
const RECENT = 8;

/**
 * /finance — the Finance overview.
 *
 * The practice could invoice all along, at /finance/invoices, but "Finance" was
 * only a heading in the sidebar and nothing on it said INVOICE. This is the page
 * that heading now opens: one big button to raise an invoice, what is owed,
 * overdue, received this month and still in draft — per currency, never added
 * across currencies — the latest invoices, and a way into every finance
 * register.
 *
 * Every figure is the register's own: the tiles are `financeHubTiles`
 * (lib/finance/hub.ts), which is `receivablesSummary` and `isOverdue` plus the
 * month's payments in exact minor units. Read-only; tenant-scoped by
 * lib/data/invoices.ts.
 */
export default async function FinanceOverviewPage() {
  const today = ymd(new Date());
  const [invoices, onBooks, systemCurrency, t] = await Promise.all([
    listInvoices(),
    listInvoicesOnBooks(),
    getSystemCurrency(),
    getServerT(),
  ]);

  const payments: HubPayment[] = onBooks.flatMap((inv) =>
    inv.payments.map((p) => ({
      currency: inv.currency,
      amount: p.amount,
      paidAt: p.paidAt,
      invoiceStatus: inv.status,
    })),
  );
  const tiles = financeHubTiles(invoices, payments, today, systemCurrency);
  const recent = invoices.slice(0, RECENT);

  const money = (n: number, currency: string) =>
    formatCurrency(n, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const links: NavItem[] = [
    INVOICES_ITEM,
    CREDIT_NOTES_ITEM,
    RECEIVABLES_ITEM,
    { label: "Overdue chase", href: "/finance/invoices/overdue", icon: BellRing },
    TIME_ITEM,
    EXPENSES_ITEM,
    PROFIT_ITEM,
    TAX_ITEM,
    { label: "Accounting export", href: "/exports", icon: Download },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-fg">{t("Finance")}</h1>
          <p className="mt-1 text-sm text-muted">
            {t("Raise an invoice, see what is owed and what has come in, and open every finance register.")}
          </p>
        </div>
        {/* The one thing this page is for, as large as the header. */}
        <Link
          href="/finance/invoices/new"
          className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-brand px-6 text-base font-bold uppercase tracking-wider text-brand-fg shadow-sm transition-colors hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Plus className="h-5 w-5" aria-hidden="true" strokeWidth={2.5} />
          <span>{t("Invoice")}</span>
        </Link>
      </div>

      {tiles.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center">
            <p className="text-sm font-medium text-fg">{t("Nothing has been invoiced yet.")}</p>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
              {t(
                "Raise one from an accepted proposal's payment milestones — the amounts, the tax and the client come across, and a milestone cannot be billed twice — or write one from scratch.",
              )}
            </p>
          </CardBody>
        </Card>
      ) : (
        tiles.map((row) => (
          <StatSection key={row.currency} title={fmt(t("In {currency}"), { currency: row.currency })}>
            <StatTile
              icon={HandCoins}
              label={t("Outstanding")}
              value={money(row.outstanding, row.currency)}
              sub={fmt(t("{count} open invoices"), { count: row.openCount })}
              href="/finance/receivables"
            />
            <StatTile
              icon={AlertTriangle}
              label={t("Overdue")}
              value={money(row.overdue, row.currency)}
              sub={fmt(t("{count} invoices past due"), { count: row.overdueCount })}
              href="/finance/invoices/overdue"
            />
            <StatTile
              icon={Wallet}
              label={t("Received this month")}
              value={money(row.receivedThisMonth, row.currency)}
              sub={fmt(t("{count} payments"), { count: row.receivedThisMonthCount })}
              href="/finance/invoices"
            />
            <StatTile
              icon={FilePen}
              label={t("Drafts")}
              value={String(row.drafts)}
              sub={t("not yet issued")}
              href="/finance/invoices"
            />
          </StatSection>
        ))
      )}

      {recent.length > 0 ? (
        <Card>
          <CardHeader
            title={t("Recent invoices")}
            action={
              <Link href="/finance/invoices" className="text-sm font-medium text-brand hover:underline">
                <span>{t("View all")}</span>
              </Link>
            }
          />
          <CardBody className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="pb-1.5 font-medium">{t("Invoice")}</th>
                  <th className="pb-1.5 font-medium">{t("Client")}</th>
                  <th className="pb-1.5 font-medium">{t("Date")}</th>
                  <th className="pb-1.5 font-medium">{t("Status")}</th>
                  <th className="pb-1.5 text-right font-medium">{t("Total")}</th>
                  <th className="pb-1.5 text-right font-medium">{t("Outstanding")}</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((inv) => (
                  <tr key={inv.id} className="zebra-row border-t border-border/60">
                    <td className="py-2 pr-3">
                      <Link
                        href={`/finance/invoices/${inv.id}`}
                        className="font-mono text-xs font-semibold text-brand hover:underline"
                      >
                        {inv.number}
                      </Link>
                    </td>
                    <td className="max-w-[220px] truncate py-2 pr-3 text-fg">
                      {inv.clientName}
                      {inv.projectName ? <span className="text-faint"> · {inv.projectName}</span> : null}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs tabular-nums text-muted">
                      {militaryDate(inv.issueDate)}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge tone={INVOICE_STATUS_TONE[inv.status]}>{t(INVOICE_STATUS_LABEL[inv.status])}</Badge>
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-fg">{money(inv.total, inv.currency)}</td>
                    <td className="py-2 pl-3 text-right font-mono tabular-nums text-fg">
                      {inv.outstanding > 0 ? money(inv.outstanding, inv.currency) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      ) : null}

      <div>
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">{t("Finance registers")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((item) => {
            const Icon = item.icon ?? ReceiptText;
            return (
              <Link key={item.href} href={item.href} className="group">
                <Card className="transition-colors group-hover:border-brand/40">
                  <CardBody className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-fg">{t(item.label)}</div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted group-hover:text-brand" />
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
