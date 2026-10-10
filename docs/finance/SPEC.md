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
would bill the tax twice. An invoice may carry a second tax beside the first
(BBO + BAVP) — see §6a.

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

### Receipts (0.24.0)

`prisma/sql/0031_expense_receipts.sql` · `lib/finance/receipt.ts` ·
`lib/data/expenses.ts` · `app/(app)/finance/expenses/[id]/receipt/route.ts`

One receipt per expense — a photo (JPEG, PNG, WebP, HEIC) or a PDF, up to
10 MB — stored in the private bucket under `receipts/<expenseId>/<uploadId>/`
by the drawing-intake path: the server names the object and signs an upload
URL, the browser PUTs the bytes straight to storage, and the server records the
row only after reading the object's real size and type back from storage. The
row carries the filename, type, size and time; the storage key never leaves the
data layer.

Changing a receipt follows the frozen table above exactly — an invoiced expense
keeps the receipt it was billed with. Seeing one is the person who recorded the
expense or an administrator, checked in the data layer on every request; the
file is opened through a five-minute signed URL that is never stored.

## 4a. Overdue chase — F2, read for action (0.24.0)

`lib/finance/overdue.ts` · `app/(app)/finance/invoices/overdue/page.tsx`

Receivables' own rule, read for action: an issued or part-paid invoice with
money outstanding and a due date before today. Grouped by client **and
currency** — a client billed in AWG and in USD owes two amounts — with a
"Copy reminder" that produces a polite text naming the invoice, the amount
still outstanding (the balance, not the original total) and the due date.
Nothing is sent; the text is pasted into an email or a WhatsApp message by a
person.

## 5. F4 — Profit and WIP (arithmetic only, so far)

`projectProfitability` compares what a job earned at charge-out against what it
cost: labour at internal cost rates plus every expense the job incurred.

**Cost includes non-billable hours.** A project that took forty unbilled hours
to fix cost the practice those hours whether or not a client ever sees them;
leaving them out is how a job looks profitable right up until payroll.

`earned` is what the work is worth, NOT what has been invoiced or collected —
those are receivables' numbers, and mixing the two double-counts the same job.

## 6. Credit notes

`prisma/sql/0030_credit_notes.sql` · `lib/finance/calc.ts` (`invoiceBalance`,
`checkCreditNote`, `creditableByLine`) · `lib/data/credit-notes.ts` ·
`/finance/credit-notes` · `/print/finance/credit-notes/[id]`

A credit note (`CN-{year}-{NNN}`, numbered exactly like invoices) takes back
some or all of what ONE issued invoice asked for. It never edits the invoice:
the invoice stays what the client was sent, and the credit note is a second
document that reduces what it still owes.

**One balance.** `invoiceBalance` is total − payments − ISSUED credit notes,
never below zero. The register, the invoice panel and print, the receivables
tiles and ageing, and the accounting export all read it from there. A DRAFT
credit note has not been sent and a VOID one was withdrawn, so neither counts —
voiding a credit note restores the balance it took off.

**Status.** An invoice settled by credit notes with nothing received is
CREDITED; settled by payments and credits together it is PAID. Both are
derived, never stored.

**The ceiling.** A credit note can never exceed the invoice's outstanding
balance, and no line can be credited for more than is left on it. The server
checks this when a draft is saved and again at issue, inside a transaction
that locks the invoice row, so two credits issued at once cannot both pass.

**Snapshot.** Client, currency and tax (both taxes, §6a) are copied from the invoice, never
taken from the form. A credit note in another currency from its invoice cannot
be built, and `invoiceBalance` throws rather than add one.

**Who.** Any active member of the practice (`requireActor`) may raise, edit and
delete a DRAFT — it moves no money. ISSUING and VOIDING are for an
administrator, a director or the founder (`canManagePasswords`), checked in the
actions and again in `lib/data/credit-notes.ts`. Invoices themselves are still
ungated (any member) pending the owner's decision; money going out is gated
now. ISSUED changes only by being voided with a reason.

**Where it shows.** An issued credit note reduces the invoice's balance
everywhere `invoiceBalance` is used: the invoice, the register tiles,
`/finance/receivables` (and its ageing buckets) and the client's Statement of
Account, where it is a CREDIT line on its own date.

**Not done.** Crediting an invoice does not free the proposal milestone it
billed (a credit is a concession, not an un-billing) and does not release
billed time or expenses. Refunds of overpayments are not credit notes.

## 6a. Two taxes on one invoice (0.26.0)

`prisma/sql/0032_invoice_second_tax.sql` · `lib/finance/calc.ts` (`invoiceTotals`) ·
`lib/finance/tax-report.ts` · `lib/finance/export.ts` · `lib/finance/two-taxes.test.ts`

Aruba charges BBO and BAVP on the same turnover, so an invoice may carry an
optional SECOND tax: `tax2Name`, `tax2Percent` and the stored `tax2Total`, on
`invoices` and `credit_notes`. `taxTotal` stays the FIRST tax only. No rate is
built in — the code has a 7% BBO default for proposals and no BAVP rate, so the
second tax's name and percent are typed on the invoice (placeholder "BAVP").
A second tax needs a first, needs a name, and the two together may not exceed
100% (`lib/finance/schema.ts`).

**Not compounded.** Both taxes are charged on the same taxable subtotal; the
second is never charged on the first.

**EXCLUSIVE.** Each tax is its own percentage of the taxable subtotal, rounded
half-up to the cent on its own; total = subtotal + tax 1 + tax 2.

**INCLUSIVE.** The COMBINED rate (p1 + p2) is backed out of the taxable lines
once — net = gross ÷ (1 + (p1 + p2)/100), contained tax = gross − net — and
that contained tax is split between the two in proportion to their rates by
`allocate` (largest remainder; the odd cent goes to the larger fractional
share), so the two parts add up to the contained tax exactly and the total is
still the sum of the lines. Example: 100.00 at 3% + 4% contains 6.54, split
2.80 + 3.74. The two parts always sum to what a single tax at p1 + p2 would
contain.

**One tax is unchanged.** With no second tax (null name, 0 percent) every
figure is the one-tax figure to the cent, and screens and prints show exactly
what they showed before. Existing rows were not backfilled — the columns'
defaults ARE "no second tax".

**Snapshots.** The second tax is snapshotted like the first: raising from a
proposal copies its second tax row when it is in the same mode as the first
(an invoice has one mode). A credit note copies both from its invoice and
credits both in proportion to the lines it credits.

**Tax report.** Each tax is a row under its own name and rate, so a BBO + BAVP
invoice contributes to both rows, with the same base on each. On the received
basis each tax is pro-rated on its own, so the payments' slices of each add
back to that tax's stored total to the cent. Invoice and payment rows show both
taxes and carry `tax` (both) and `tax2` (the second's part).

**Accounting export.** The invoices and credit-notes files gain `Tax 2 name`,
`Tax 2 %` and `Tax 2` after `Tax`; the tax ledger gains the same three, and on
every row Net + Tax + Tax 2 = Gross (`Tax` is the first tax).

**Not done.** Raising an invoice from time and expenses still offers one tax;
a second can be added on the draft before it is issued.

## 7. Not built yet

- Billing time and expenses ONTO an invoice — the columns exist
  (`invoicedAt`, `invoiceId`, `invoiceNumber`, `invoiceLineId`) and the guard
  is written, but nothing sets them yet.
- The profit / WIP screens. (The per-project finance tab shipped in 0.23.0:
  app/(app)/projects/[id]/finance, lib/finance/project-finance.ts.)
- Any billing provider. (The accounting export — invoices, lines, payments,
  approved time and expenses as CSV for a period — shipped in 0.11.0:
  lib/finance/export.ts, app/api/export/finance/[kind]/route.ts.)
