import type { Metadata } from "next";
import { getServerT } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { ExpenseForm } from "@/components/finance/expense-form";
import { ExpenseReceipt } from "@/components/finance/expense-receipt";
import { canChangeReceipt, canViewReceipt } from "@/lib/finance/receipt";
import { getExpense } from "@/lib/data/expenses";
import { getProjects } from "@/lib/data/projects";
import { listTimekeepers } from "@/lib/data/time-entries";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { ymd } from "@/lib/building-permits/register";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  return { title: `${t("Edit an expense")} · AEC-flow` };
}

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [actor, expense, projects, people] = await Promise.all([
    requireActor(),
    getExpense(id),
    getProjects(),
    listTimekeepers(),
  ]);
  if (!expense) notFound();

  const canApprove = canManagePasswords(actor.role, actor.isFounder);
  const t = await getServerT();
  // The same three tests the data layer applies, so a locked row shows why
  // rather than failing on save. The gate that counts is still the server's.
  const locked =
    Boolean(expense.invoicedAt) ||
    (expense.userId !== actor.id && !canApprove) ||
    (expense.status === "APPROVED" && !canApprove);
  // The receipt is open to whoever recorded the expense and to administrators;
  // it can be changed exactly when the expense can. lib/data/expenses.ts checks
  // both again on every request.
  const viewer = { id: actor.id, isAdmin: canApprove };
  const receiptViewable = canViewReceipt(expense, viewer);
  const receiptChangeable = canChangeReceipt(expense, viewer);

  return (
    <div className="w-full space-y-4">
      <Link
        href="/finance/expenses"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> {t("Expenses")}
      </Link>

      {locked ? (
        <Card>
          <CardBody className="py-8 text-center text-sm text-muted">
            {expense.invoicedAt
              ? fmt(t("This expense is on invoice {number}, so it cannot be changed."), {
                  number: expense.invoiceNumber ?? t("already raised"),
                })
              : expense.status === "APPROVED"
                ? t("This expense has been approved. Ask a director to reopen it.")
                : t("This expense belongs to a colleague.")}
          </CardBody>
        </Card>
      ) : (
        <ExpenseForm
          mode="edit"
          initial={expense}
          projects={projects.map((p) => ({ id: p.id, name: `${p.projectNumber} — ${p.name}` }))}
          people={canApprove ? people.map((p) => ({ id: p.id, name: p.name })) : []}
          canRecordForOthers={canApprove}
          today={ymd(new Date())}
        />
      )}

      {receiptViewable || receiptChangeable ? (
        <ExpenseReceipt
          expenseId={expense.id}
          receipt={expense.receipt}
          canView={receiptViewable}
          canChange={receiptChangeable}
        />
      ) : null}
    </div>
  );
}
