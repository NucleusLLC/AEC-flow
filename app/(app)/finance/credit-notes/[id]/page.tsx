import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CreditNotePanel } from "@/components/finance/credit-note-panel";
import { getCreditNote } from "@/lib/data/credit-notes";
import { militaryDate } from "@/lib/building-permits/register";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Credit note")} · AEC-flow` };
}

export default async function CreditNotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const note = await getCreditNote(id);
  if (!note) notFound();
  const t = await getServerT();

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link
        href="/finance/credit-notes"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("Credit notes")}
      </Link>

      <div className="min-w-0">
        <h2 className="font-mono text-xl font-semibold text-fg">{note.number}</h2>
        <p className="mt-1 text-sm text-muted">
          {note.clientName}
          {note.projectName ? ` · ${note.projectName}` : ""}
        </p>
      </div>

      <CreditNotePanel note={note} />

      <Card>
        <CardHeader title={t("Details").toUpperCase()} />
        <CardBody className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {[
            { label: t("Reason"), value: note.reason },
            { label: t("Currency"), value: note.currency, mono: true },
            { label: t("Raised by"), value: note.createdByName ?? "—" },
            { label: t("Issued by"), value: note.issuedByName ?? "—" },
            { label: t("Issued"), value: militaryDate(note.issuedAt), mono: true },
            { label: t("Attention of"), value: note.contactName ?? "—" },
          ].map((f) => (
            <div
              key={f.label}
              className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 text-sm"
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{f.label}</span>
              <span className={`text-right text-fg ${f.mono ? "font-mono text-xs" : ""}`}>{f.value}</span>
            </div>
          ))}
          {note.notes ? (
            <p className="whitespace-pre-line text-sm text-muted sm:col-span-2">
              <span className="text-faint">{t("Internal notes:")} </span>
              {note.notes}
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
