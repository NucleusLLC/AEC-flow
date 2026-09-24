"use client";

/**
 * The expense editor.
 *
 * THE CHARGEABLE FIGURE IS COMPUTED HERE BY THE FUNCTION THE SERVER STORES
 * THROUGH (`expenseChargeable` in lib/finance/timesheet.ts), so what the person
 * sees while typing a markup is what a client would be asked to pay.
 *
 * A NON-BILLABLE EXPENSE HIDES THE MARKUP rather than greying it out: a
 * handling percentage on a cost nobody will be charged is a field with no
 * meaning, and leaving it on screen invites somebody to fill it in and expect
 * something to happen.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { currencyOptions, formatCurrency, getSystemCurrency } from "@/lib/format";
import { expenseChargeable } from "@/lib/finance/timesheet";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
  type ExpenseDTO,
  type ExpenseInput,
} from "@/lib/finance/types";
import {
  recordExpenseAction,
  updateExpenseAction,
} from "@/app/(app)/finance/expenses/actions";

const field =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const input = `h-9 ${field} py-0`;
const label = "mb-1 block text-xs font-medium text-muted";

export type PickerOption = { id: string; name: string };

export function ExpenseForm({
  mode,
  initial,
  projects,
  people,
  canRecordForOthers,
  today,
}: {
  mode: "new" | "edit";
  initial?: ExpenseDTO;
  projects: PickerOption[];
  people: PickerOption[];
  canRecordForOthers: boolean;
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState(initial?.userId ?? "");
  const [projectId, setProjectId] = useState(initial?.projectId ?? "");
  const [date, setDate] = useState(initial?.date ?? today);
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? "OTHER");
  const [vendor, setVendor] = useState(initial?.vendor ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [currency, setCurrency] = useState(initial?.currency ?? getSystemCurrency());
  const [billable, setBillable] = useState(initial?.billable ?? true);
  const [markupPercent, setMarkupPercent] = useState(
    initial ? String(initial.markupPercent) : "0",
  );
  const [reimbursable, setReimbursable] = useState(initial?.reimbursable ?? false);

  const netAmount = Number(amount.replace(/[\s,]/g, ""));
  const markup = Number(markupPercent.replace(",", "."));
  const chargeable = billable
    ? expenseChargeable(Number.isFinite(netAmount) ? netAmount : 0, Number.isFinite(markup) ? markup : 0, currency)
    : 0;

  function save() {
    setError(null);
    const payload: ExpenseInput = {
      userId: canRecordForOthers && userId ? userId : null,
      projectId: projectId || null,
      date,
      category,
      vendor: vendor.trim() || null,
      description: description.trim(),
      amount: netAmount,
      currency,
      billable,
      markupPercent: billable ? markup : 0,
      reimbursable,
    };
    startTransition(async () => {
      const result =
        mode === "edit" && initial
          ? await updateExpenseAction(initial.id, payload)
          : await recordExpenseAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/finance/expenses");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title={mode === "edit" ? "Edit the expense" : "Record an expense"}
        subtitle="What was spent stays what was spent; a markup only changes what a client is charged."
      />
      <CardBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className={label}>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={input}
            />
          </div>

          <div>
            <span className={label}>Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className={input}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className={label}>Project</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className={input}
            >
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <span className={label}>What the money was spent on</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A0 plots for the permit submission"
              className={input}
            />
          </div>

          <div>
            <span className={label}>Paid to</span>
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Vendor"
              className={input}
            />
          </div>

          <div>
            <span className={label}>Amount</span>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              className={`${input} text-right font-mono tabular-nums`}
            />
          </div>

          <div>
            <span className={label}>Currency</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={input}
            >
              {currencyOptions(["AWG", "USD", "ANG", "EUR"]).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {billable ? (
            <div>
              <span className={label}>Handling markup %</span>
              <input
                value={markupPercent}
                onChange={(e) => setMarkupPercent(e.target.value)}
                inputMode="decimal"
                className={`${input} text-right font-mono tabular-nums`}
              />
            </div>
          ) : null}

          {canRecordForOthers && people.length > 0 ? (
            <div>
              <span className={label}>Incurred by</span>
              <select value={userId} onChange={(e) => setUserId(e.target.value)} className={input}>
                <option value="">Me</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={billable}
              onChange={(e) => setBillable(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Rechargeable to the client
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={reimbursable}
              onChange={(e) => setReimbursable(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Paid out of pocket — the practice owes it back
          </label>
          <span className="ml-auto text-sm text-muted">
            Chargeable{" "}
            <span className="font-mono font-semibold tabular-nums text-fg">
              {formatCurrency(chargeable, currency, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </span>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-600/30 bg-red-600/5 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={pending || !description.trim() || !(netAmount > 0)}
            className="inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-60"
          >
            {mode === "edit" ? "Save" : "Record it"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/finance/expenses")}
            className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm text-muted hover:bg-surface-2"
          >
            Cancel
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
