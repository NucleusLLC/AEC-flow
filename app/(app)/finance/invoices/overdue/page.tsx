import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";
import { OverdueChaseView } from "@/components/finance/overdue-chase";
import { listInvoices } from "@/lib/data/invoices";
import { requireActor } from "@/lib/server/actor";
import { getFirmIdentity } from "@/lib/server/firm";
import { ymd } from "@/lib/building-permits/register";
import { isOverdue } from "@/lib/finance/overdue";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Overdue chase")} · AEC-flow` };
}

/**
 * Who owes money past its due date, by client, with a reminder to copy into an
 * email or a WhatsApp message. Nothing is sent from here. The list is the
 * invoice register's own data (tenant-scoped by lib/data/invoices.ts), filtered
 * by the rule in lib/finance/overdue.ts.
 */
export default async function OverdueChasePage() {
  const today = ymd(new Date());
  const [actor, invoices, firm, t] = await Promise.all([
    requireActor(),
    listInvoices(),
    getFirmIdentity(),
    getServerT(),
  ]);
  // Only what the list needs crosses to the browser.
  const overdue = invoices
    .filter((i) => isOverdue(i, today))
    .map((i) => ({
      id: i.id,
      number: i.number,
      status: i.status,
      currency: i.currency,
      clientId: i.clientId,
      clientName: i.clientName,
      projectName: i.projectName,
      issueDate: i.issueDate,
      dueDate: i.dueDate,
      total: i.total,
      outstanding: i.outstanding,
    }));
  const sender = [actor.name, firm.name === "AEC-flow" ? "" : firm.name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join("\n");

  return (
    <div className="w-full space-y-6">
      <Link
        href="/finance/invoices"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> {t("Invoices")}
      </Link>
      <div>
        <h2 className="text-xl font-semibold text-fg">{t("Overdue chase")}</h2>
        <p className="text-sm text-muted">
          {t(
            "Invoices with money still outstanding after their due date, by client. Copy a reminder and send it yourself — nothing is emailed from here.",
          )}
        </p>
      </div>
      <OverdueChaseView invoices={overdue} today={today} sender={sender} />
    </div>
  );
}
