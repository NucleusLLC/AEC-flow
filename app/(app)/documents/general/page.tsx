import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { DocumentRegister } from "@/components/general-documents/document-register";
import { listGeneralDocuments } from "@/lib/data/general-documents";
import { ymd } from "@/lib/building-permits/register";
import { CATALOGUE } from "@/lib/general-documents/catalogue";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";

export const metadata: Metadata = { title: "General Documents · AEC-flow" };

export default async function GeneralDocumentsPage() {
  const documents = await listGeneralDocuments();
  const today = ymd(new Date());
  const t = await getServerT();

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("General Documents")}</h2>
          <p className="text-sm text-muted">
            {t(
              "The letters and instruments a practice writes around a project — powers of attorney, letters of intent, NDAs, RFIs, RFQs, notices and transmittals.",
            )}
          </p>
        </div>
        <Link
          href="/documents/general/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" /> {t("New document")}
        </Link>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-sm font-medium text-fg">{t("No document written yet.")}</p>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
              {fmt(
                t(
                  "{count} types are ready to fill in — a power of attorney to file a permit on a client's behalf, an NDA before a tender, an RFQ to a supplier, a notice of practical completion. Each one writes itself from what you type and prints on the practice's letterhead.",
                ),
                { count: CATALOGUE.length },
              )}
            </p>
            <Link
              href="/documents/general/new"
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
            >
              <Plus className="h-4 w-4" /> {t("Write the first one")}
            </Link>
          </CardBody>
        </Card>
      ) : (
        <DocumentRegister documents={documents} today={today} />
      )}
    </div>
  );
}
