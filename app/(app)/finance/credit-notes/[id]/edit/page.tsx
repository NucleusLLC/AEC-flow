import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CreditNoteForm } from "@/components/finance/credit-note-form";
import { getCreditNote, getCreditableInvoice } from "@/lib/data/credit-notes";
import { ymd } from "@/lib/building-permits/register";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Credit note")} · AEC-flow` };
}

export default async function EditCreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = await getCreditNote(id);
  if (!note) notFound();
  // Draft-only, like invoices: an issued credit note changes only by being voided.
  if (note.status !== "DRAFT") redirect(`/finance/credit-notes/${note.id}`);
  // The limits with THIS draft left out, so its own figures are not counted twice.
  const invoice = await getCreditableInvoice(note.invoiceId, note.id);
  if (!invoice) notFound();
  const t = await getServerT();

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link
        href={`/finance/credit-notes/${note.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {note.number}
      </Link>
      <h2 className="text-xl font-semibold uppercase tracking-wide text-fg">
        {fmt(t("Edit {number}"), { number: note.number })}
      </h2>
      <CreditNoteForm invoice={invoice} initial={note} today={ymd(new Date())} />
    </div>
  );
}
