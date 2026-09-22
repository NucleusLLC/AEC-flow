# Finance — specification

What the finance module is, what it refuses to do, and why. Three files already
point here (`lib/finance/calc.ts`, `lib/db.ts`, `components/finance/invoice-register.tsx`);
this is the document they meant.

The module ships in stages. **F1 invoices** and **F2 receivables** are live.
**F3 time and expenses** is this release. **F4 profit and work-in-progress** is
half-built — the arithmetic exists and is tested, the screens do not.

---

## 1. The rules that hold across the whole module

**Money is never a float.** Every amount goes through
`lib/proposals/engine/money.ts`, the repo's one exact-money primitive, which
works in integer minor units. There is no second rounding helper anywhere in
finance, and adding one is the bug this rule exists to prevent.

**Hours are not money.** They are a quantity, rounded to two decimals at the
boundary and kept as plain numbers. Rounding hours to cents would be
meaningless; keeping them as floats through a sum would not be, so
`roundHours` is applied at every accumulation.

**A total across currencies is a number with no meaning.** Every summary
function takes one currency and the screens filter to it before adding
anything up, and say which one they are showing. This is why
`receivablesSummary`, `expenseSummary` and `unbilledByProject` all take a
`currency` argument they do not infer.

**Everything on a document a client has seen is a snapshot.** The client's
name, the tax name and percentage, the line descriptions, the amounts, and —
on a timesheet — the charge-out and cost rates are copied on at the moment the
row is saved. A rate rise next quarter prices the next hour logged. A renamed
client does not rewrite an invoice sent in March.

**Status follows the money where the money decides it, and a person where a
person decides it.** An invoice's paid state is derived from its payments and
cannot be set by hand. A timesheet's approval state is set by an approver and
is not derived from anything. Being BILLED is neither — it is a fact recorded
on the row (`invoicedAt`), and that separation is what stops hours being
billed twice.

**Every finance table is tenant-scoped and locked out of the Data API.** All of
them are in `TENANT_MODELS` (`lib/db.ts`) and every migration ends with
`ENABLE ROW LEVEL SECURITY` (see `prisma/sql/0012_lock_down_data_api.sql`).
Receivables, rates and timesheets are the most obviously private tables in the
app.

---

## 2. F1 — Invoices

`prisma/sql/0016_invoices.sql` · `lib/finance/calc.ts` · `lib/data/invoices.ts`

An invoice is raised from an accepted proposal's payment milestones or written
from scratch. Each line that came from a milestone keeps `milestoneId`, which
is the double-bill guard: the "raise from proposal" screen reads back what has
already been billed and offers only the remainder. Voiding frees the milestone
again.

A DRAFT may be edited or deleted. An ISSUED invoice may not: it changes by
being paid or by being voided with a reason. Tax is snapshotted, and INCLUSIVE
tax is backed out of the line amounts rather than added to them — adding it
would bill the tax twice.

## 3. F2 — Receivables

The same tables, read differently. `receivablesSummary` gives billed, received,
outstanding and overdue per currency, plus an ageing split
(`current / 1-30 / 31-60 / 61-90 / 90+`). Drafts are counted but never added to
what is owed — a draft has not been asked for — and voids are counted nowhere.
Only an invoice with money outstanding can be overdue: a paid invoice whose due
date has passed is history, not a debt.

## 4. F3 — Time and expenses

`prisma/sql/0020_time_expenses.sql` · `lib/finance/timesheet.ts` ·
`lib/data/time-entries.ts` · `lib/data/expenses.ts`

### What is recorded

A **time entry** is a day, a number of hours, a project, and whether the hours
are billable. It carries the person's charge-out and cost rates as they were
when it was saved. An **expense** is a date, a category, an amount and whether
it is rechargeable, plus an optional handling markup and a flag for money that
came out of somebody's own pocket.

### The approval chain

    DRAFT ──submit──▶ SUBMITTED ──approve──▶ APPROVED ──▶ (invoiced)
      ▲                    │
      └──── reject ────────┘   (a rejection always carries a reason)

One enum, `FinanceApprovalStatus`, for both tables: it is one decision, made by
one person, about one kind of thing. Editing a row returns it to DRAFT, so a
dealt-with rejection does not keep its flag and a row an approver never saw
does not sit in their queue.

### Who may do what

You log your own hours and record your own expenses. Logging for somebody else,
approving, rejecting, reopening, setting rates and marking a reimbursement paid
are member-administrator work — ADMIN, DIRECTOR or the founder, the
`canManagePasswords` gate the rest of the app uses. The checks are in the data
layer, not the screens, because a server action is a public endpoint.

A colleague's rates are not public: `listTimekeepers` hands anybody who is not
an administrator exactly one row, their own.

### What is frozen

| Row is… | Owner may edit | Approver may edit |
| --- | --- | --- |
| DRAFT or REJECTED | yes | yes |
| SUBMITTED | yes (returns it to DRAFT) | yes |
| APPROVED | no | yes |
| Invoiced | no | no |

An invoiced row is never edited and never deleted. Deletion anywhere here is
soft (`deletedAt`), and the tables carry **no foreign key to `invoices`** —
voiding an invoice must not take a month of timesheets with it.

### Work in progress

`unbilledByProject` is the number a practice raises its next invoice from, and
it is deliberately strict: billable, APPROVED, and not already invoiced. The
week's own totals (`timesheetTotals`) are looser on purpose — they price
billable hours whatever their approval state, because a director looking at a
week wants to see work that has not been signed off yet, not a hole where it
should be.

## 5. F4 — Profit and WIP (arithmetic only, so far)

`projectProfitability` compares what a job earned at charge-out against what it
cost: labour at internal cost rates plus every expense the job incurred.

**Cost includes non-billable hours.** A project that took forty unbilled hours
to fix cost the practice those hours whether or not a client ever sees them;
leaving them out is how a job looks profitable right up until payroll.

`earned` is what the work is worth, NOT what has been invoiced or collected —
those are receivables' numbers, and mixing the two double-counts the same job.

## 6. Not built yet

- Billing time and expenses ONTO an invoice — the columns exist
  (`invoicedAt`, `invoiceId`, `invoiceNumber`, `invoiceLineId`) and the guard
  is written, but nothing sets them yet.
- The profit / WIP screens, and a per-project finance tab.
- Receipt images on an expense.
- Credit notes. A negative line amount is refused rather than quietly
  accepted as one.
- Any accounting export, and any billing provider.
