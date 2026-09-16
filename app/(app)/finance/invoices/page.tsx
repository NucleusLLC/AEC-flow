import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { InvoiceRegister } from "@/components/finance/invoice-register";
import { listInvoices } from "@/lib/data/invoices";
import { ymd } from "@/lib/building-permits/register";

export const metadata: Metadata = { title: "Invoices · AEC-flow" };

export default async function InvoicesPage() {
  const invoices = await listInvoices();
  const today = ymd(new Date());

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-fg">Invoices</h2>
          <p className="text-sm text-muted">
            What the practice has billed, what has come in, and what is still owed.
          </p>
        </div>
        <Link
          href="/finance/invoices/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" /> New invoice
        </Link>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-sm font-medium text-fg">Nothing has been invoiced yet.</p>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
              Raise one from an accepted proposal&apos;s payment milestones — the amounts, the tax
              and the client come across, and a milestone cannot be billed twice — or write one from
              scratch.
            </p>
            <Link
              href="/finance/invoices/new"
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
            >
              <Plus className="h-4 w-4" /> Raise the first invoice
            </Link>
          </CardBody>
        </Card>
      ) : (
        <InvoiceRegister invoices={invoices} today={today} />
      )}
    </div>
  );
}
