import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { PrintSurface } from "@/components/print/print-surface";
import { TaxReportView } from "@/components/finance/tax-report-view";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { listInvoicesForExport } from "@/lib/data/invoices";
import { buildTaxReport, lastFullMonth, periodFromRange } from "@/lib/finance/tax-report";
import { militaryDate } from "@/lib/building-permits/register";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Tax report")} · ${t("Print")}` };
}

/**
 * The tax report on A4: /print/finance/tax?from=YYYY-MM-DD&to=YYYY-MM-DD.
 * A range that is a calendar month or quarter is titled as one ("OCT 2026",
 * "Q3 2026"); a missing or bad range prints the last full month.
 *
 * Same gate as the screen and the CSV: Admin, Director, the founder.
 */
export default async function TaxReportPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const t = await getServerT();
  const actor = await requireActor().catch(() => null);
  const allowed = actor ? canManagePasswords(actor.role, actor.isFounder) : false;
  if (!allowed) {
    return (
      <PrintSurface backHref="/finance/tax" backLabel={t("Tax report")}>
        <p className="py-12 text-center text-sm font-medium text-gray-900" data-testid="tax-not-allowed">
          {t("The tax report shows the practice’s turnover. Only an Admin or a Director can open it.")}
        </p>
      </PrintSurface>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const { from, to } = await searchParams;
  const period = periodFromRange(from, to) ?? lastFullMonth(today);
  const [invoices, practice, firm] = await Promise.all([
    listInvoicesForExport(),
    getPracticeSettings(),
    getFirmIdentity(),
  ]);
  const report = buildTaxReport(invoices, { from: period.from, to: period.to });
  const backKey = period.kind === "range" ? "" : `?period=${period.key}`;

  return (
    <PrintSurface backHref={`/finance/tax${backKey}`} backLabel={t("Tax report")}>
      <DocumentLetterhead
        logo={{
          dataUrl: practice.logoDataUrl,
          position: practice.logo.position,
          size: practice.logo.size,
        }}
        name={firm.name}
        tagline={t("Architecture · Engineering · Project Management")}
        borderClass="border-b-2 border-[#4b5320] pb-4"
        details={
          <div className="text-right">
            <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#4b5320]">{t("Tax report")}</div>
            <div className="mt-1 font-mono text-base font-bold tracking-widest text-gray-900" data-testid="tax-period">
              {period.label}
            </div>
            <div className="text-[11px] text-gray-500">
              {militaryDate(period.from)} – {militaryDate(period.to)}
            </div>
          </div>
        }
      />

      <div className="mt-5">
        <TaxReportView t={t} report={report} />
      </div>

      <div className="mt-6 border-t border-gray-200 pt-3 text-center text-[10px] uppercase tracking-wider text-gray-400">
        {firm.name} · {t("Tax report")} · {period.label} · {militaryDate(today)}
      </div>
    </PrintSurface>
  );
}
