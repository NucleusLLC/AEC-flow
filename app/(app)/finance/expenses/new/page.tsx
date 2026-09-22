import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ExpenseForm } from "@/components/finance/expense-form";
import { getProjects } from "@/lib/data/projects";
import { listTimekeepers } from "@/lib/data/time-entries";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { ymd } from "@/lib/building-permits/register";

export const metadata: Metadata = { title: "Record an expense · AEC-flow" };

export default async function NewExpensePage() {
  const [actor, projects, people] = await Promise.all([
    requireActor(),
    getProjects(),
    // Hands a non-approver only their own row, so the "incurred by" picker is
    // simply absent for them — which is also the rule the data layer enforces.
    listTimekeepers(),
  ]);
  const canRecordForOthers = canManagePasswords(actor.role, actor.isFounder);

  return (
    <div className="w-full space-y-4">
      <Link
        href="/finance/expenses"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Expenses
      </Link>
      <ExpenseForm
        mode="new"
        projects={projects.map((p) => ({ id: p.id, name: `${p.projectNumber} — ${p.name}` }))}
        people={canRecordForOthers ? people.map((p) => ({ id: p.id, name: p.name })) : []}
        canRecordForOthers={canRecordForOthers}
        today={ymd(new Date())}
      />
    </div>
  );
}
