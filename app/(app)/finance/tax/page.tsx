import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";
import { Card, CardBody } from "@/components/ui/card";
import { TaxReportView } from "@/components/finance/tax-report-view";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { countDraftInvoicesIssued, listInvoicesForExport } from "@/lib/data/invoices";
import { buildTaxReport, parsePeriod, periodOptions, shiftPeriod } from "@/lib/finance/tax-report";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Tax report")} · AEC-flow` };
}

/**
 * Turnover tax (BBO, BAVP, whatever the invoices carry) for a month or a
 * quarter, on two bases: what was invoiced and what was received.
 *
 * Gated like the accounting export (Admin, Director, the founder): it is the
 * practice's turnover. The numbers come from lib/finance/tax-report.ts, which
 * the print sheet and the "tax" CSV also use.
 *
 * The period picker is a plain GET form, so the page works without JavaScript
 * and a period can be bookmarked: /finance/tax?period=2026-Q3.
 */
export default async function TaxReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const t = await getServerT();
  const actor = await requireActor().catch(() => null);
  const allowed = actor ? canManagePasswords(actor.role, actor.isFounder) : false;

  const header = (
    <div>
      <h2 className="text-xl font-semibold text-fg">{t("Tax report")}</h2>
      <p className="text-sm text-muted">
        {t("Turnover tax (BBO, BAVP and any other) as your invoices carry it, per currency. Nothing is imputed: an invoice without tax is listed under Notes.")}
      </p>
    </div>
  );

  if (!allowed) {
    return (
      <div className="w-full space-y-6">
        {header}
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-sm font-medium text-fg" data-testid="tax-not-allowed">
              {t("This one is for directors and administrators.")}
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted">
              {t("The tax report shows the practice’s turnover. Only an Admin or a Director can open it.")}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const { period: periodKey } = await searchParams;
  const period = parsePeriod(periodKey, today);
  const [invoices, drafts] = await Promise.all([
    listInvoicesForExport(),
    countDraftInvoicesIssued(period.from, period.to),
  ]);
  const report = buildTaxReport(invoices, { from: period.from, to: period.to });
  report.excluded.drafts += drafts;
  const options = periodOptions(today);
  const prev = shiftPeriod(period, -1);
  const next = shiftPeriod(period, 1);
  const range = `from=${period.from}&to=${period.to}`;

  const olive =
    "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#5c6633] bg-[#4b5320] px-3 text-sm font-semibold uppercase tracking-wide text-[#e4e8dc] shadow-sm hover:bg-[#3f4a1c]";
  const sand =
    "inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#5c6633] bg-[#e4e8dc] px-3 text-sm font-bold uppercase tracking-wider text-[#4b5320] hover:bg-[#c5d18a]";

  return (
    <div className="w-full space-y-6">
      {header}

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-[#5c6633] bg-[#4b5320] px-4 py-3 text-[#e4e8dc]">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c5d18a]">{t("Period")}</div>
          <div className="font-mono text-2xl font-bold tracking-widest" data-testid="tax-period">
            {period.label}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/finance/tax?period=${prev.key}`} className={sand} aria-label={t("Previous")}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <form method="get" action="/finance/tax" className="flex items-center gap-2">
            <select
              name="period"
              defaultValue={period.key}
              aria-label={t("Period")}
              className="h-9 rounded-lg border border-[#5c6633] bg-[#e4e8dc] px-2 font-mono text-sm font-semibold uppercase text-[#4b5320]"
            >
              <optgroup label={t("Month")}>
                {options.months.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </optgroup>
              <optgroup label={t("Quarter")}>
                {options.quarters.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </optgroup>
            </select>
            <button type="submit" className={sand}>{t("Show")}</button>
          </form>
          <Link href={`/finance/tax?period=${next.key}`} className={sand} aria-label={t("Next")}>
            <ChevronRight className="h-4 w-4" />
          </Link>
          <a href={`/print/finance/tax?${range}`} target="_blank" className={olive}>
            <Printer className="h-4 w-4" />
            {t("Print")}
          </a>
          <a href={`/api/export/finance/tax?${range}`} download className={olive}>
            <Download className="h-4 w-4" />
            {t("Download CSV")}
          </a>
        </div>
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-black/5">
        <TaxReportView t={t} report={report} />
      </div>
    </div>
  );
}
