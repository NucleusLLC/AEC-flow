import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { CreditNoteRegister } from "@/components/finance/credit-note-register";
import { listCreditNotes } from "@/lib/data/credit-notes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Credit notes")} · AEC-flow` };
}

/**
 * The credit note register. A credit note is raised FROM an invoice (its
 * "Raise credit note" button), never from here: it only exists against one.
 */
export default async function CreditNotesPage() {
  const notes = await listCreditNotes();
  const t = await getServerT();

  return (
    <div className="w-full space-y-6">
      <div>
        <h2 className="text-xl font-semibold uppercase tracking-wide text-fg">{t("Credit notes")}</h2>
        <p className="text-sm text-muted">{t("What the practice has taken back from its invoices, and why.")}</p>
      </div>

      {notes.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-sm font-medium uppercase tracking-wide text-fg">{t("No credit notes yet.")}</p>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
              {t("Open an issued invoice with a balance outstanding and raise one from there.")}
            </p>
            <Link
              href="/finance/invoices"
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-semibold uppercase tracking-wider text-fg hover:bg-surface-2"
            >
              {t("Invoices")}
            </Link>
          </CardBody>
        </Card>
      ) : (
        <CreditNoteRegister notes={notes} />
      )}
    </div>
  );
}
