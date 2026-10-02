import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ReceiptText } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";
import { ReceivablesTable } from "@/components/finance/receivables-table";
import { listReceivableInvoices } from "@/lib/data/receivables";
import { receivablesByClient } from "@/lib/finance/receivables";
import { militaryDate, ymd } from "@/lib/building-permits/register";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Receivables")} · AEC-flow` };
}

/**
 * Receivables by client. Visible to whoever may see the invoice register —
 * see lib/data/receivables.ts for why the gate is exactly that one.
 */
export default async function ReceivablesPage() {
  let invoices;
  try {
    invoices = await listReceivableInvoices();
  } catch {
    redirect("/login");
  }
  const today = ymd(new Date());
  const rows = receivablesByClient(invoices, today);
  const t = await getServerT();

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("Receivables")}</h2>
          <p className="text-sm text-muted">
            {t("Who owes the practice what, by client and by how late.")}{" "}
            <span className="font-mono text-xs uppercase">
              {t("As at")} {militaryDate(today)}
            </span>
          </p>
        </div>
        <Link
          href="/finance/invoices"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <ReceiptText className="h-4 w-4" /> {t("Invoices")}
        </Link>
      </div>

      <ReceivablesTable rows={rows} />
    </div>
  );
}
