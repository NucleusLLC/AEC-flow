import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer, Building2, Pencil } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { CertStatusBadge } from "@/components/construction-admin/badges";
import { getCertification } from "@/lib/data/ca/certifications";
import { formatCurrency, formatDate } from "@/lib/format";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const c = await getCertification(id);
  return { title: c ? `${c.certificationNumber} · ZenArch` : "Certification · ZenArch" };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="shrink-0 text-xs text-muted">{label}</span>
      <span className="text-right text-sm text-fg">{children}</span>
    </div>
  );
}

function MoneyRow({ label, value, currency, strong }: { label: string; value: number; currency: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={strong ? "font-semibold text-fg" : "text-fg"}>{formatCurrency(value, currency)}</span>
    </div>
  );
}

export default async function CertificationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const c = await getCertification(id);
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link href="/construction-admin/certifications" className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg">
        <ArrowLeft className="h-4 w-4" />
        Certifications
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-faint">{c.certificationNumber}</span>
            <CertStatusBadge status={c.status} />
          </div>
          <h2 className="mt-1 text-xl font-semibold text-fg">Progress Certification</h2>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Building2 className="h-3.5 w-3.5" />
            {c.projectName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/construction-admin/certifications/${c.id}/edit`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
          <a
            href={`/print/construction-admin/certifications/${c.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Payment Recommendation" />
            <CardBody className="space-y-2">
              <MoneyRow label="Contract value" value={c.contractValue} currency={c.currency} />
              <Row label="Percent complete">{c.previousPercentComplete}% → {c.currentPercentComplete}%</Row>
              <div className="border-t border-border pt-2">
                <MoneyRow label="Work completed value" value={c.workCompletedValue} currency={c.currency} />
                <MoneyRow label={`Retention (${c.retentionPercentage}%)`} value={c.retentionAmount} currency={c.currency} />
                <MoneyRow label="Previous payments" value={c.previousPaymentsValue} currency={c.currency} />
                <div className="border-t border-border pt-2">
                  <MoneyRow label="Recommended for payment" value={c.amountRecommendedForPayment} currency={c.currency} strong />
                </div>
              </div>
            </CardBody>
          </Card>

          {c.deficiencies || c.recommendation ? (
            <Card>
              <CardHeader title="Findings" />
              <CardBody className="space-y-3">
                {c.deficiencies ? (
                  <div>
                    <div className="text-xs text-muted">Deficiencies</div>
                    <p className="mt-0.5 text-sm text-fg">{c.deficiencies}</p>
                  </div>
                ) : null}
                {c.recommendation ? (
                  <div>
                    <div className="text-xs text-muted">Recommendation</div>
                    <p className="mt-0.5 text-sm text-fg">{c.recommendation}</p>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <CardBody className="divide-y divide-border py-0">
              <Row label="Inspection date">{formatDate(c.inspectionDate)}</Row>
              <Row label="Certified by">{c.certifiedBy ?? "—"}</Row>
              <Row label="Lender / bank">{c.lenderName ?? "—"}</Row>
              <Row label="Contractor">{c.contractorName ?? "—"}</Row>
              <Row label="Updated">{formatDate(c.updatedAt)}</Row>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
