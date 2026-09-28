import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { ExpenseRegister } from "@/components/finance/expense-register";
import { listExpenses } from "@/lib/data/expenses";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Expenses")} · AEC-flow` };
}

export default async function ExpensesPage() {
  const [actor, expenses] = await Promise.all([requireActor(), listExpenses()]);
  const canApprove = canManagePasswords(actor.role, actor.isFounder);
  const t = await getServerT();

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-fg">{t("Expenses")}</h2>
          <p className="text-sm text-muted">
            {t("What a job cost beyond the hours — and which of it a client is charged for.")}
          </p>
        </div>
        <Link
          href="/finance/expenses/new"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
        >
          <Plus className="h-4 w-4" /> {t("Record an expense")}
        </Link>
      </div>

      {expenses.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-sm font-medium text-fg">{t("Nothing has been recorded yet.")}</p>
            <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
              {t(
                "Plots, permit fees, a subconsultant's invoice, a trip to the site. Mark what a client is charged for and it joins the work waiting to be billed; mark what the practice carries and it counts against the job's margin instead.",
              )}
            </p>
            <Link
              href="/finance/expenses/new"
              className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
            >
              <Plus className="h-4 w-4" /> {t("Record the first one")}
            </Link>
          </CardBody>
        </Card>
      ) : (
        <ExpenseRegister expenses={expenses} canApprove={canApprove} currentUserId={actor.id} />
      )}
    </div>
  );
}
