import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getServerT } from "@/lib/i18n/server";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { PrintSurface } from "@/components/print/print-surface";
import { StatementLedger } from "@/components/finance/statement-ledger";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
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
  return { title: `${t("Statement of Account")} · ${t("Print")}` };
}

/**
 * The Statement of Account as the client receives it, on the same print shell,
 * letterhead and A4 `@page` rules as the invoice (PrintSurface owns the margins
 * and the "Page X of Y" footer). The figures are the screen's figures: both are
 * `clientStatement` over the same invoices and period.
 */
export default async function StatementPrintPage({
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
  const [practice, firm, t] = await Promise.all([getPracticeSettings(), getFirmIdentity(), getServerT()]);

  const today = ymd(new Date());
  const period = statementPeriod(query.from, query.to, today);
  const currencies = statementCurrencies(invoices);
  const statements = currencies
    .map((cur) => clientStatement(invoices, period, cur))
    .filter((s) => !isEmptyStatement(s));

  return (
    <PrintSurface
      backHref={`/finance/receivables/${client.id}?from=${period.from}&to=${period.to}`}
      backLabel="Statement of Account"
    >
      <DocumentLetterhead
        logo={{
          dataUrl: practice.logoDataUrl,
          position: practice.logo.position,
          size: practice.logo.size,
        }}
        name={firm.name}
        tagline={t("Architecture · Engineering · Project Management")}
        borderClass="border-b-2 border-gray-900 pb-4"
        details={
          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">
              {t("Statement of Account")}
            </div>
            <div className="mt-1 font-mono text-[11px] uppercase text-gray-600">
              {militaryDate(period.from)} – {militaryDate(period.to)}
            </div>
            <div className="text-[10px] uppercase text-gray-500">
              {t("As at")} {militaryDate(period.to)}
            </div>
          </div>
        }
      />

      <div className="mt-6 flex flex-wrap justify-between gap-6 text-[11px] leading-relaxed">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-gray-400">{t("Client")}</div>
          <div className="font-semibold text-gray-900">{client.name}</div>
          {client.contactPerson ? <div className="text-gray-700">{client.contactPerson}</div> : null}
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wide text-gray-400">{t("Email")}</div>
          <div className="text-gray-900">{client.email ?? "—"}</div>
          <div className="mt-1 text-[9px] uppercase tracking-wide text-gray-400">{t("Cell")}</div>
          <div className="font-mono text-gray-900">{client.mobile ?? "—"}</div>
        </div>
      </div>

      {statements.length === 0 ? (
        <p className="mt-8 text-[11px] text-gray-600">{currencies.length === 0
            ? t("Nothing has been invoiced to this client yet.")
            : t("No invoices or payments in this period.")}</p>
      ) : (
        statements.map((s) => (
          <section key={s.currency} className="mt-6">
            <h2 className="mb-1 border-b border-gray-300 pb-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-gray-600">
              {s.currency}
            </h2>
            <StatementLedger statement={s} t={t} variant="print" />
          </section>
        ))
      )}

      <div className="mt-8 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
        {firm.name} · {client.name} ·{" "}
        {statements
          .map((s) =>
            `${formatCurrency(s.closing, s.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${s.currency}`,
          )
          .join(" · ")}
      </div>
    </PrintSurface>
  );
}
