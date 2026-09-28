import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmailButton } from "@/components/email/email-button";
import { InvoicePanel } from "@/components/finance/invoice-panel";
import { getInvoice } from "@/lib/data/invoices";
import { militaryDate, ymd } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Invoice")} · AEC-flow` };
}

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  const today = ymd(new Date());
  const t = await getServerT();
  const money = (n: number) =>
    formatCurrency(n, invoice.currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link
        href="/finance/invoices"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("Invoices")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-mono text-xl font-semibold text-fg">{invoice.number}</h2>
          <p className="mt-1 text-sm text-muted">
            {invoice.clientName}
            {invoice.projectName ? ` · ${invoice.projectName}` : ""}
            {invoice.title ? ` · ${invoice.title}` : ""}
          </p>
        </div>
        <EmailButton
          subject={`Invoice ${invoice.number} — ${invoice.clientName}`}
          attachment={`${invoice.number}`}
          label={t("Email")}
          defaultTo={invoice.contactEmail ?? ""}
          relatedType="invoice"
          relatedId={invoice.id}
          linkPath={`/print/finance/invoices/${invoice.id}`}
          defaultBody={[
            `Invoice ${invoice.number} for ${money(invoice.total)}`,
            invoice.dueDate ? `, due ${militaryDate(invoice.dueDate)}` : "",
            ".",
          ].join("")}
        />
      </div>

      <InvoicePanel invoice={invoice} today={today} />

      <Card>
        <CardHeader title={t("Details")} />
        <CardBody className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {[
            { label: t("Invoice date"), value: militaryDate(invoice.issueDate), mono: true },
            { label: t("Due"), value: militaryDate(invoice.dueDate), mono: true },
            {
              label: t("Terms"),
              value:
                invoice.termsDays === null
                  ? "—"
                  : fmt(t("{count} days"), { count: invoice.termsDays }),
            },
            { label: t("Currency"), value: invoice.currency, mono: true },
            { label: t("Attention of"), value: invoice.contactName ?? "—" },
            { label: t("Email"), value: invoice.contactEmail ?? "—" },
            { label: t("From proposal"), value: invoice.proposalNumber ?? "—", mono: true },
            { label: t("Raised by"), value: invoice.createdByName ?? "—" },
            { label: t("Issued by"), value: invoice.issuedByName ?? "—" },
          ].map((f) => (
            <div
              key={f.label}
              className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 text-sm"
            >
              <span className="text-muted">{f.label}</span>
              <span className={`text-right text-fg ${f.mono ? "font-mono text-xs" : ""}`}>
                {f.value}
              </span>
            </div>
          ))}
          {invoice.intro ? (
            <p className="whitespace-pre-line text-sm text-fg sm:col-span-2">{invoice.intro}</p>
          ) : null}
          {invoice.notes ? (
            <p className="whitespace-pre-line text-sm text-muted sm:col-span-2">
              <span className="text-faint">{t("Internal notes:")} </span>
              {invoice.notes}
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
