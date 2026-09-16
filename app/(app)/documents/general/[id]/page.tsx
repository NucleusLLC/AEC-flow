import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmailButton } from "@/components/email/email-button";
import { DocumentActions } from "@/components/general-documents/document-actions";
import {
  DocumentCategoryBadge,
  DocumentStatusBadge,
} from "@/components/general-documents/badges";
import { getGeneralDocument } from "@/lib/data/general-documents";
import { catalogueEntry } from "@/lib/general-documents/catalogue";
import { militaryDate, ymd } from "@/lib/building-permits/register";

export const metadata: Metadata = { title: "Document · AEC-flow" };

export default async function GeneralDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await getGeneralDocument(id);
  if (!doc) notFound();

  const today = ymd(new Date());
  const entry = catalogueEntry(doc.docType);

  const facts: { label: string; value: string; mono?: boolean }[] = [
    { label: "Type", value: doc.docTypeLabel },
    { label: "Client", value: doc.clientName ?? "—" },
    { label: "Project", value: doc.projectName ?? "—" },
    { label: "Addressed to", value: doc.counterpartyName ?? doc.contactName ?? "—" },
    { label: "Our reference", value: doc.reference ?? "—", mono: true },
    { label: "Dated", value: militaryDate(doc.issueDate), mono: true },
    { label: "Effective from", value: militaryDate(doc.effectiveDate), mono: true },
    { label: "Runs to", value: militaryDate(doc.expiryDate), mono: true },
    { label: "Signed", value: militaryDate(doc.signedAt), mono: true },
    { label: "Written by", value: doc.createdByName ?? "—" },
  ];

  return (
    <div className="w-full max-w-5xl space-y-6">
      <Link
        href="/documents/general"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        General Documents
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-mono text-xl font-semibold text-fg">{doc.number}</h2>
            <DocumentStatusBadge status={doc.status} />
            <DocumentCategoryBadge category={doc.category} />
          </div>
          <p className="mt-1 text-sm text-muted">{doc.title}</p>
        </div>
        <EmailButton
          subject={doc.title}
          attachment={`${doc.number} — ${doc.docTypeLabel}`}
          label="Email"
          defaultTo={doc.contactEmail ?? ""}
          relatedType="general-document"
          relatedId={doc.id}
          linkPath={`/print/documents/general/${doc.id}`}
          defaultBody={`${doc.title} (${doc.number}) is attached to this message as a link to the signed-in copy.`}
        />
      </div>

      <DocumentActions document={doc} today={today} />

      {doc.status === "VOID" && doc.voidReason ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-fg">
          Voided: {doc.voidReason}
        </p>
      ) : null}
      {doc.status === "SUPERSEDED" ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm text-fg">
          Superseded by a later document. It stays here as the record of what was issued.
        </p>
      ) : null}

      <Card>
        <CardHeader
          title="The document"
          subtitle={
            doc.status === "DRAFT"
              ? "Still a draft — edit it freely until it is issued."
              : "Issued. Supersede it rather than editing it."
          }
        />
        <CardBody>
          <article className="space-y-3 font-serif text-[15px] leading-relaxed text-fg">
            {doc.body.map((paragraph, i) => (
              <p key={i} className="whitespace-pre-line">
                {paragraph}
              </p>
            ))}
          </article>

          {entry ? (
            <div className="mt-6 grid gap-6 border-t border-border pt-4 sm:grid-cols-3">
              {entry.signatures.map((block) => (
                <div key={block.role}>
                  <div className="h-px w-full bg-border" />
                  <div className="mt-1 text-xs text-muted">
                    {block.role.replace(/\{\{firmName\}\}/g, "the practice")}
                  </div>
                  <div className="text-[11px] text-faint">Name · Date</div>
                </div>
              ))}
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Particulars" />
        <CardBody className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {facts.map((f) => (
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
          {doc.notes ? (
            <p className="whitespace-pre-line text-sm text-muted sm:col-span-2">
              <span className="text-faint">Internal notes: </span>
              {doc.notes}
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
