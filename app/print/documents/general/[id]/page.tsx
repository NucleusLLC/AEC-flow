import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentLetterhead } from "@/components/print/document-letterhead";
import { PrintSurface } from "@/components/print/print-surface";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { getGeneralDocument } from "@/lib/data/general-documents";
import { catalogueEntry } from "@/lib/general-documents/catalogue";
import { renderSignatures } from "@/lib/general-documents/render";
import { militaryDate } from "@/lib/building-permits/register";
import { GENERAL_DOCUMENT_STATUS_LABEL } from "@/lib/general-documents/types";

export const metadata: Metadata = { title: "Document · Print" };

/**
 * A general document on the practice's letterhead.
 *
 * It prints the STORED paragraphs, not a freshly rendered template: this is the
 * copy that gets signed, and it has to read exactly as it read when it was
 * issued. The signature blocks come from the catalogue entry, with the party
 * names filled in — a power of attorney needs the principal, the attorney and a
 * witness, and a bare "signature" line under a legal instrument is useless.
 *
 * A DRAFT prints with the word DRAFT beside its number. A document that says
 * nothing about being a draft is one that gets signed by accident.
 */
export default async function GeneralDocumentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [doc, practice, firm] = await Promise.all([
    getGeneralDocument(id),
    getPracticeSettings(),
    getFirmIdentity(),
  ]);
  if (!doc) notFound();

  const entry = catalogueEntry(doc.docType);
  const signatures = entry
    ? renderSignatures(entry, {
        firmName: firm.name,
        clientName: doc.clientName,
        counterpartyName: doc.counterpartyName,
      })
    : [];

  const addressee = [doc.counterpartyName, doc.counterpartyAddress].filter(Boolean);
  const isDraft = doc.status === "DRAFT";

  return (
    <PrintSurface backHref={`/documents/general/${doc.id}`} backLabel={doc.number}>
      <DocumentLetterhead
        logo={{
          dataUrl: practice.logoDataUrl,
          position: practice.logo.position,
          size: practice.logo.size,
        }}
        name={firm.name}
        tagline="Architecture · Engineering · Project Management"
        borderClass="border-b-2 border-gray-900 pb-4"
        details={
          <div className="text-right">
            <div className="text-sm font-semibold uppercase tracking-wide text-gray-900">
              {doc.docTypeLabel}
            </div>
            <div className="mt-1 font-mono text-xs text-gray-600">
              {doc.number}
              {doc.reference ? ` · ${doc.reference}` : ""}
            </div>
            <div className="text-[11px] text-gray-500">
              {militaryDate(doc.issueDate)}
              {isDraft ? " · DRAFT" : ""}
              {doc.status === "VOID" ? " · VOID" : ""}
              {doc.status === "SUPERSEDED" ? " · SUPERSEDED" : ""}
            </div>
          </div>
        }
      />

      {addressee.length > 0 ? (
        <div className="mt-6 text-[11px] leading-relaxed text-gray-700">
          {addressee.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}

      <h1 className="mt-6 text-lg font-bold text-gray-900">{doc.title}</h1>
      {doc.subject ? (
        <p className="mt-1 text-[11px] uppercase tracking-wide text-gray-500">{doc.subject}</p>
      ) : null}

      <article className="mt-4 space-y-3 text-[11.5px] leading-relaxed text-gray-900">
        {doc.body.map((paragraph, i) => (
          <p key={i} className="whitespace-pre-line">
            {paragraph}
          </p>
        ))}
      </article>

      {signatures.length > 0 ? (
        <div className="mt-12 break-inside-avoid border-t border-gray-300 pt-8">
          <div className="grid grid-cols-2 gap-x-10 gap-y-10">
            {signatures.map((block, i) => (
              <div key={`${block.role}-${i}`} className={block.witness ? "col-span-2" : ""}>
                <div className="h-px w-full bg-gray-400" />
                <div className="mt-1 text-[11px] font-medium text-gray-700">{block.role}</div>
                <div className="text-[10px] text-gray-500">
                  {block.name ? `${block.name} · ` : ""}Name · Date
                  {block.witness ? " · Seal" : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {isDraft ? (
        <p className="mt-8 text-[9px] uppercase tracking-wide text-gray-400">
          Draft — not issued. Status: {GENERAL_DOCUMENT_STATUS_LABEL[doc.status]}.
        </p>
      ) : null}

      <div className="mt-6 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-400">
        {firm.name} · {doc.number} · {doc.docTypeLabel}
      </div>
    </PrintSurface>
  );
}
