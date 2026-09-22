import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { InvoiceForm } from "@/components/finance/invoice-form";
import { getInvoice } from "@/lib/data/invoices";
import { getClients } from "@/lib/data/clients";
import { getProjects } from "@/lib/data/projects";
import { ymd } from "@/lib/building-permits/register";

export const metadata: Metadata = { title: "Edit invoice · AEC-flow" };

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();
  // Only a draft is editable — an issued invoice is what a client was asked to
  // pay, so the route refuses rather than rendering a form whose save is refused.
  if (invoice.status !== "DRAFT") redirect(`/finance/invoices/${invoice.id}`);

  const [clients, projects] = await Promise.all([getClients(), getProjects()]);

  return (
    <div className="w-full space-y-6">
      <Link
        href={`/finance/invoices/${invoice.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {invoice.number}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">Edit {invoice.number}</h2>
        <p className="text-sm text-muted">Totals recalculate as you type, and again on save.</p>
      </div>
      <InvoiceForm
        mode="edit"
        initial={invoice}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        today={ymd(new Date())}
      />
    </div>
  );
}
