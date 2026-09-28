import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaPrintShell, PrintSection } from "@/components/construction-admin/print-shell";
import { getCertification } from "@/lib/data/ca/certifications";
import { CERT_STATUS_LABEL } from "@/lib/ca/labels";
import { formatCurrency, formatDate } from "@/lib/format";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const c = await getCertification(id);
  return { title: c ? `${c.certificationNumber} — Progress Certification` : "Progress Certification" };
}

export default async function CertificationPrintPage({ params }: PageProps) {
  const t = await getServerT();
  const { id } = await params;
  const c = await getCertification(id);
  if (!c) notFound();
  const money = (v: number) => formatCurrency(v, c.currency);

  return (
    <CaPrintShell
      backHref={`/construction-admin/certifications/${c.id}`}
      docTitle={t("Progress Certification")}
      refNumber={c.certificationNumber}
      statusLabel={t(CERT_STATUS_LABEL[c.status])}
      title={c.projectName}
      meta={[
        { label: t("Inspection"), value: formatDate(c.inspectionDate) },
        { label: t("Certified by"), value: c.certifiedBy ?? "—" },
        { label: t("Lender"), value: c.lenderName ?? "—" },
        { label: t("Contractor"), value: c.contractorName ?? "—" },
      ]}
      signatures={[
        { role: t("Certified by (Engineer/Architect)"), name: c.certifiedBy ?? "" },
        { role: t("Contractor"), name: c.contractorName ?? "" },
        { role: t("Lender / Owner"), name: c.lenderName ?? "" },
      ]}
    >
      <PrintSection title={t("Valuation & Recommended Payment")}>
        <table className="w-full border-collapse text-[11.5px]">
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-3 text-gray-700">{t("Contract value")}</td>
              <td className="py-1.5 text-right tabular-nums text-gray-900">{money(c.contractValue)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-3 text-gray-700">{t("Percent complete (previous → current)")}</td>
              <td className="py-1.5 text-right text-gray-900">{c.previousPercentComplete}% → {c.currentPercentComplete}%</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-3 text-gray-700">{t("Work completed value")}</td>
              <td className="py-1.5 text-right tabular-nums text-gray-900">{money(c.workCompletedValue)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-3 text-gray-700">{fmt(t("Retention ({pct}%)"), { pct: c.retentionPercentage })}</td>
              <td className="py-1.5 text-right tabular-nums text-gray-900">− {money(c.retentionAmount)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-1.5 pr-3 text-gray-700">{t("Previous payments")}</td>
              <td className="py-1.5 text-right tabular-nums text-gray-900">− {money(c.previousPaymentsValue)}</td>
            </tr>
            <tr className="border-t-2 border-gray-900">
              <td className="py-2 pr-3 font-semibold text-gray-900">{t("Amount recommended for payment")}</td>
              <td className="py-2 text-right font-bold tabular-nums text-gray-900">{money(c.amountRecommendedForPayment)}</td>
            </tr>
          </tbody>
        </table>
      </PrintSection>

      {c.deficiencies ? (
        <PrintSection title={t("Deficiencies")}>
          <p className="whitespace-pre-wrap text-gray-800">{c.deficiencies}</p>
        </PrintSection>
      ) : null}
      {c.recommendation ? (
        <PrintSection title={t("Recommendation")}>
          <p className="whitespace-pre-wrap text-gray-800">{c.recommendation}</p>
        </PrintSection>
      ) : null}
    </CaPrintShell>
  );
}
