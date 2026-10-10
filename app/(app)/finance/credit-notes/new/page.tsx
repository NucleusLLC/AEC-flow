import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { CreditNoteForm } from "@/components/finance/credit-note-form";
import { getCreditableInvoice } from "@/lib/data/credit-notes";
import { ymd } from "@/lib/building-permits/register";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Raise credit note")} · AEC-flow` };
}

/** Raise a credit note against ONE invoice: /finance/credit-notes/new?invoice=<id>. */
export default async function NewCreditNotePage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  const { invoice: invoiceId } = await searchParams;
  if (!invoiceId) notFound();
  const invoice = await getCreditableInvoice(invoiceId);
  if (!invoice) notFound();
  const t = await getServerT();

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link
        href={`/finance/invoices/${invoice.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {invoice.number}
      </Link>
      <div>
        <h2 className="text-xl font-semibold uppercase tracking-wide text-fg">
          {fmt(t("Credit note against {number}"), { number: invoice.number })}
        </h2>
        <p className="text-sm text-muted">
          {invoice.clientName}
          {invoice.projectName ? ` · ${invoice.projectName}` : ""}
        </p>
      </div>
      {invoice.available > 0 ? (
        <CreditNoteForm invoice={invoice} today={ymd(new Date())} />
      ) : (
        <Card>
          <CardBody className="py-10 text-center text-sm font-medium uppercase tracking-wide text-fg">
            {t("Nothing outstanding on this invoice to credit.")}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
