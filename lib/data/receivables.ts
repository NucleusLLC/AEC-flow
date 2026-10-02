/**
 * Receivables by client and the Statement of Account — data access. SERVER-ONLY.
 *
 * WHO MAY READ THIS. Exactly who may read the invoice register today: any
 * signed-in member of the practice. The register, an invoice and its printed
 * sheet carry no role gate (only the accounting export does), and this view is
 * the same invoices grouped by client, so a stricter gate here would hide from
 * someone a total they can add up on the next screen, and a looser one would be
 * a leak. Every loader resolves the actor first (`requireActor`), so a request
 * with no session — or a deactivated account holding an old token — gets
 * nothing, whatever AUTH_ENFORCE says.
 *
 * Invoice and Client are tenant-scoped by the Prisma extension (lib/db.ts), so
 * one practice can never see another's clients or invoices through these.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { requireActor } from "@/lib/server/actor";
import { listInvoicesOnBooks } from "@/lib/data/invoices";
import type { LedgerInvoice } from "@/lib/finance/receivables";
import type { InvoiceDTO } from "@/lib/finance/types";

export type StatementClient = {
  id: string;
  name: string;
  companyName: string | null;
  contactPerson: string | null;
  email: string | null;
  mobile: string | null;
};

function toLedger(i: InvoiceDTO): LedgerInvoice {
  return {
    id: i.id,
    number: i.number,
    status: i.status,
    currency: i.currency,
    clientId: i.clientId,
    clientName: i.clientName,
    issueDate: i.issueDate,
    dueDate: i.dueDate,
    createdAt: i.createdAt,
    total: i.total,
    payments: i.payments.map((p) => ({
      id: p.id,
      paidAt: p.paidAt,
      amount: p.amount,
      reference: p.reference,
    })),
  };
}

/** Every invoice in the practice's books, for receivables by client. */
export async function listReceivableInvoices(): Promise<LedgerInvoice[]> {
  await requireActor();
  return (await listInvoicesOnBooks()).map(toLedger);
}

/** One client and their invoices, for the statement. Null when not this practice's. */
export async function getStatementData(
  clientId: string,
): Promise<{ client: StatementClient; invoices: LedgerInvoice[] } | null> {
  await requireActor();
  const client = await prisma.client.findFirst({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      companyName: true,
      contactPerson: true,
      email: true,
      mobile: true,
    },
  });
  if (!client) return null;
  const invoices = (await listInvoicesOnBooks({ clientId: client.id })).map(toLedger);
  return { client, invoices };
}
