import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import Link from "next/link";
import { BellRing, Plus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { InvoiceRegister } from "@/components/finance/invoice-register";
import { listInvoices } from "@/lib/data/invoices";
import { ymd } from "@/lib/building-permits/register";
import { isOverdue } from "@/lib/finance/overdue";
import { fmt } from "@/lib/i18n/format";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Invoices")} · AEC-flow` };
}

export default async function InvoicesPage() {
  const invoices = await listInvoices();
  const today = ymd(new Date());
  const t = await getServerT();
  const overdueCount = invoices.filter((i) => isOverdue(i, today)).length;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("Invoices")}</h2>
          <p className="text-sm text-muted">
            {t("What the practice has billed, what has come in, and what is still owed.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/finance/invoices/overdue"
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-surface-2 ${
              overdueCount > 0 ? "border-red-600/40 text-red-600" : "border-border text-fg"
            }`}
          >
            <BellRing className="h-4 w-4" />
            {overdueCount > 0
              ? fmt(t("Overdue chase ({count})"), { count: overdueCount })
              : t("Overdue chase")}
          </Link>
          <Link
            href="/finance/invoices/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            <Plus className="h-4 w-4" /> {t("New invoice")}
          </Link>
        </div>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-sm font-medium text-fg">{t("Nothing has been invoiced yet.")}</p>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
              {t(
                "Raise one from an accepted proposal's payment milestones — the amounts, the tax and the client come across, and a milestone cannot be billed twice — or write one from scratch.",
              )}
            </p>
            <Link
              href="/finance/invoices/new"
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
            >
              <Plus className="h-4 w-4" /> {t("Raise the first invoice")}
            </Link>
          </CardBody>
        </Card>
      ) : (
        <InvoiceRegister invoices={invoices} today={today} />
      )}
    </div>
  );
}
