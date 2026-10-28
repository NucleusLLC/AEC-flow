# Finance — specification

What the finance module is, what it refuses to do, and why. Three files already
point here (`lib/finance/calc.ts`, `lib/db.ts`, `components/finance/invoice-register.tsx`);
this is the document they meant.

The module ships in stages. **F1 invoices**, **F2 receivables**, **F3 time and
expenses** (including billing them onto an invoice) and **F4 profit** are live.
**Invoicing Phase B** (0.38.0, §6c) adds emailing an invoice with its PDF, the
SENT status, re-issuing a void invoice, numbered receipts, payment reversal and
a discount before tax.

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

## 5. F4 — Profit and WIP

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

## 6b. Pay online — Stripe Connect (0.36.0)

`prisma/sql/0034_stripe_pay_now.sql` · `lib/payments/` · `lib/data/pay-now.ts` ·
`app/pay/[token]` · `app/api/stripe/webhook` · owner setup: `docs/finance/STRIPE.md`

A client pays an issued invoice by card. **The money goes to the practice, never
to Nucleus.** Nucleus LLC's Stripe account is the Connect platform; each practice
connects its own Standard account (Settings → Integrations → Online payments,
Admin / Director only, Stripe-hosted onboarding via Account Links), and the
checkout is a **direct charge on that account** (`Stripe-Account` header). No
platform fee (`PLATFORM_FEE_BASIS_POINTS = 0`). Stripe's own fees are the
practice's.

**The link.** While the practice can take cards and an invoice is ISSUED or
PART_PAID with money owing, the invoice page shows a "Pay online link" to copy
and the printed invoice carries the URL. It is `/pay/<token>`, 32 random bytes
base64url, stored on the invoice (`payToken`, unique) and created the first
time it is shown. Stored, not hashed: the same link must reprint on every copy
of the invoice. The page is public (proxy.ts), like the TV boards, and shows
only the number, the practice, the due date and the amount owed now.

**The amount** is always the current outstanding balance (`invoiceBalance`:
total less payments and issued credit notes), computed on the server at the
moment the client presses Pay, converted to minor units by money.ts. Zero- and
three-decimal currencies are refused rather than mis-scaled; AWG, USD, EUR are
two-decimal. The Checkout page expires after 60 minutes.

**Recording.** Only the signed webhook records a payment — never the success
page. `checkout.session.completed` (and `async_payment_succeeded`) with
`payment_status = paid` becomes an InvoicePayment through the SAME path as a
hand-recorded payment (`recordPayment`), method STRIPE ("Card (Stripe)"),
reference = the PaymentIntent, so the paid state stays DERIVED. The
PaymentIntent is UNIQUE on the payment row: a replayed event is a no-op. A
payment is recorded only when the event's connected account is the invoice
practice's own. The webhook has no session, so it runs inside the invoice's
company with `runAsCompany` (AsyncLocalStorage, lib/server/request-company.ts):
React `cache` — what `companyOverride()` relies on — does not hold in a route
handler. STRIPE cannot be chosen when recording a payment by hand.

**Not done.** Refunds and disputes are handled in the practice's Stripe
dashboard and are not mirrored back (a refunded card payment must be reversed
on the invoice by hand, with a reason — §6c). Money taken against an invoice voided while the
client was on the Checkout page is logged as PAID BUT NOT RECORDED and must be
refunded in Stripe. Two tabs paying at once can overpay; the invoice then shows
the overpayment like any other.

## 6c. Invoicing Phase B (0.38.0)

`prisma/sql/0037_invoice_phase_b.sql` · `lib/finance/calc.ts` (`discountedTotals`,
`discountAmount`, `nextReceiptNumber`, `reissueNumber`, `livePayments`) ·
`lib/finance/invoice-pdf.ts` · `lib/server/invoice-email.ts` ·
`lib/data/invoices.ts` · `app/print/finance/receipts/[paymentId]` ·
`lib/finance/phase-b.test.ts`, `invoice-pdf.test.ts`, `lib/server/invoice-email.test.ts`

**SENT, and the PDF that goes with it.** "Email invoice" (any member, issued
invoices only — never a draft or a void) sends the invoice as a PDF attachment
through `sendDocumentEmail`, the app's one email path. To is prefilled from the
invoice's contact email and takes several addresses; subject and body are
prefilled and editable. The invoice is stamped — `sentAt`, `sentTo`,
`sentByName` (snapshots), `sentCount` + 1 — and moved ISSUED → SENT **only when
the provider returned a message id** (`ok: true`). A failure of any kind (no API
key, a refused address, an unconfirmed send) leaves the invoice exactly as it
was and the composed message on screen; every attempt, failed or not, is in the
email log against the invoice. Re-sending is allowed: the stamp shows the LAST
send plus the count, and the email log is the full history — no second history
table.

SENT is ISSUED that has also been emailed. It is open exactly like ISSUED
(`OPEN_STATUSES`): receivables, ageing, the overdue chase, the register's "Not
paid" filter, the tax report, the export, the finance overview and the Pay
online link all treat it the same, and payments derive PART_PAID / PAID from it
as from ISSUED. A reversed payment drops it back to SENT.

**The PDF is built on the server without a browser** — `pdf-lib` 1.17.1, pinned
exactly. Vercel's Node functions have no Chromium; pdf-lib is plain JavaScript
writing PDF operators with the standard fonts, so there is nothing native,
nothing WebAssembly and no font file to ship. It carries the print page's
facts: the practice's name, location and logo (PNG or JPEG), number and dates,
who it is billed to, the lines, the discount, both taxes, the totals, payments
received (with receipt numbers) and the balance, the bank details and the terms
& conditions from Settings > Invoicing (inline or on their own sheet), and
"Page x of y" on every sheet. The standard fonts are WinAnsi only: a label whose
translation needs another script (Chinese, Japanese) prints in English, and
characters in data that cannot be drawn print as "?". The same file opens at
`/finance/invoices/[id]/pdf` ("Download PDF").

**Re-issue as `-2`.** A VOID invoice can be re-issued (administrator, director
or founder): a new DRAFT with the same client, lines, taxes, discount, notes and
footer, dated today, numbered `<root>-2`, then `-3` …, where `root` is the first
invoice in the chain and the suffix is one past the highest ever used on that
root (soft-deleted drafts included) — never reused, and still unique per
practice by `@@unique([companyId, number])`. The new invoice carries
`reissuedFromId` / `reissuedFromNumber` ("Re-issue of …" on screen, "Replaces …"
on its print); the void one finds its re-issues by that link ("Re-issued as …").
Only one live re-issue at a time. **Milestones:** voiding freed them; re-issuing
claims them again, so it is refused if, re-read on the server, another live
invoice (drafts included) now bills one of them. **Not re-claimed:** time and
expenses the void released to the unbilled list — the copied lines do not carry
them, so they could be billed again by hand.

**Numbered receipts.** Every payment, manual or recorded by the Stripe webhook,
gets `RCT-{year it was received}-{NNN}`, one past the highest receipt number the
practice has ever used, allocated **inside the same transaction as the payment
insert** under a per-practice advisory lock, and unique per practice
(`invoice_payments_companyId_receiptNumber_key`). Reversed payments keep their
number. **Backfill:** 0037 numbers every existing payment deterministically —
per practice, in the order received (paidAt, createdAt, id), continuing after
any number already present — and only where the number is still null, so a
second run changes nothing. A payment that slipped in between the SQL and the
deploy (or a sample-data row) is numbered the first time its receipt is opened.
The receipt prints at `/print/finance/receipts/[paymentId]` (same shell and
footer as the invoice) and is emailed as a PDF from the payment row.

**Reversal, not deletion.** A payment can no longer be deleted from the screens
or by any action. It is REVERSED (administrator, director or founder) with a
required reason: `reversedAt`, `reversedById`, `reversedByName`,
`reverseReason`. It stays on the invoice, struck through, and its receipt prints
REVERSED with the reason. It counts towards nothing: the data layer keeps
reversed payments OUT of `InvoiceDTO.payments` (they are in `reversedPayments`),
so every reader of payments — the balance, the derived status, receivables and
the Statement of Account, the overdue chase, the tax report (both bases), the
accounting export, the finance overview, the credit-note ceiling — ignores them
without a filter of its own to forget; `invoiceBalance` also skips any payment
with `reversedAt` as a second lock. A Stripe card payment refunded in Stripe is
reversed the same way.

**Discount before tax.** An invoice may carry one discount: PERCENT of the
subtotal or a fixed AMOUNT (`InvoiceDiscountType`), snapshotted as
`discountType`, `discountValue` and the `discountTotal` it came to. It comes off
the subtotal BEFORE tax: its share of the taxable lines (split between taxed and
untaxed lines in proportion, by `allocate`, so the shares add back to the cent)
comes off the base each tax is charged on, and `taxableSubtotal` stores that
discounted base. EXCLUSIVE: total = subtotal − discount + taxes. INCLUSIVE: the
discount comes off the gross amounts and the tax is backed out of what is left;
total = subtotal − discount. A percentage is rounded half-up to the cent; 100%
leaves nothing to pay; a negative discount, a percentage over 100 and an amount
over the subtotal are refused (zod and the data layer), never clamped. With no
discount every figure is the pre-0.38 one (`invoiceTotals` is
`discountedTotals` with none). It shows on the form, the invoice screen, the
print, the PDF and the export (`Discount type`, `Discount %`, `Discount`); the
tax report's untaxed figure is net of it.

**Who.** Emailing, issuing and recording payments: any member. Voiding,
re-issuing, reversing a payment and deleting a draft: administrator, director
or founder (`lib/finance/invoice-permissions.ts`), checked in the actions and
again in `lib/data/invoices.ts`.

**Not done.** A credit note against a discounted invoice credits line amounts
before the discount (its ceiling — never more than the balance — still holds).
Raising from a proposal or from time and expenses offers no discount; add one on
the draft. The email log is the send history; there is no per-send table.

## 7. Not built yet

- Work-in-progress as a screen of its own (the arithmetic, `unbilledByProject`,
  feeds "Raise from time and expenses" and the project finance tab).
- Refunds of overpayments, and mirroring Stripe refunds and disputes back
  automatically (a refunded card payment is reversed by hand, §6c).
- Any billing provider beyond card payments through Stripe (0.36.0, §6b).

Shipped since this list was first written: billing time and expenses onto an
invoice (`lib/data/work-billing.ts`, "Raise from time and expenses"), the
profit screen (`/finance/profit`), the per-project finance tab (0.23.0,
`app/(app)/projects/[id]/finance`) and the accounting export (0.11.0,
`lib/finance/export.ts`).
