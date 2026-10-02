import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";
import { Card, CardBody } from "@/components/ui/card";
import { EmailButton } from "@/components/email/email-button";
import { StatementLedger } from "@/components/finance/statement-ledger";
import { getStatementData } from "@/lib/data/receivables";
import {
  clientStatement,
  isEmptyStatement,
  statementCurrencies,
  statementPeriod,
} from "@/lib/finance/receivables";
import { militaryDate, ymd } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Statement of Account")} · AEC-flow` };
}

const CONTROL =
  "h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";

/**
 * A client's Statement of Account on screen: a running-balance ledger per
 * currency for a chosen period (default the last 12 months), printable and
 * emailable as a link. Same gate as the invoice register (lib/data/receivables.ts).
 */
export default async function ClientStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const [{ clientId }, query] = await Promise.all([params, searchParams]);
  let data;
  try {
    data = await getStatementData(clientId);
  } catch {
    redirect("/login");
  }
  if (!data) notFound();
  const { client, invoices } = data;

  const today = ymd(new Date());
  const period = statementPeriod(query.from, query.to, today);
  const currencies = statementCurrencies(invoices);
  const statements = currencies
    .map((cur) => clientStatement(invoices, period, cur))
    .filter((s) => !isEmptyStatement(s));
  const t = await getServerT();
  const qs = `from=${period.from}&to=${period.to}`;
  const printPath = `/print/finance/statement/${client.id}?${qs}`;

  return (
    <div className="w-full max-w-6xl space-y-6">
      <Link
        href="/finance/receivables"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("Receivables")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">{t("Statement of Account")}</p>
          <h2 className="text-xl font-semibold text-fg">{client.name}</h2>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-sm">
            <dt className="text-[11px] uppercase tracking-wide text-faint">{t("Email")}</dt>
            <dd className="text-fg">{client.email ?? "—"}</dd>
            <dt className="text-[11px] uppercase tracking-wide text-faint">{t("Cell")}</dt>
            <dd className="font-mono text-fg">{client.mobile ?? "—"}</dd>
          </dl>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={printPath}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <Printer className="h-4 w-4" /> {t("Print statement")}
          </Link>
          <EmailButton
            subject={`Statement of Account — ${client.name} — ${militaryDate(period.from)} to ${militaryDate(period.to)}`}
            attachment={`Statement ${client.name}`}
            label={t("Email")}
            defaultTo={client.email ?? ""}
            relatedType="statement"
            relatedId={client.id}
            linkPath={printPath}
            defaultBody={[
              `Statement of Account for ${militaryDate(period.from)} to ${militaryDate(period.to)}.`,
              ...statements.map(
                (s) =>
                  `Balance ${s.currency}: ${formatCurrency(s.closing, s.currency, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}.`,
              ),
            ].join(" ")}
          />
        </div>
      </div>

      <Card>
        <CardBody className="py-3">
          <form method="get" className="flex flex-wrap items-end gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-faint">{t("From")}</span>
              <input type="date" name="from" defaultValue={period.from} className={CONTROL} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-faint">{t("Until")}</span>
              <input type="date" name="to" defaultValue={period.to} className={CONTROL} />
            </label>
            <button
              type="submit"
              className="h-9 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
            >
              {t("Show")}
            </button>
            <span className="font-mono text-xs uppercase text-muted">
              {militaryDate(period.from)} – {militaryDate(period.to)}
            </span>
          </form>
        </CardBody>
      </Card>

      {statements.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center text-sm text-muted">
            {currencies.length === 0
              ? t("Nothing has been invoiced to this client yet.")
              : t("No invoices or payments in this period.")}
          </CardBody>
        </Card>
      ) : (
        statements.map((s) => (
          <Card key={s.currency}>
            <CardBody className="space-y-2">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wide text-muted">{s.currency}</h3>
              <StatementLedger statement={s} t={t} variant="screen" />
            </CardBody>
          </Card>
        ))
      )}
    </div>
  );
}
