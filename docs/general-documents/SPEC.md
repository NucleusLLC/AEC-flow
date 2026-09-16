# General Documents — Specification (Release A)

The letters and instruments a practice writes around a project but outside any
one system: a power of attorney to file a permit on a client's behalf, a letter
of intent before the contract exists, an NDA before a tender, an RFI to an
engineer, an RFQ to a supplier, a notice of practical completion, a transmittal.

Additive and self-contained. It touches neither protected system (Estimates,
Schedule — `docs/protected-systems.md`), and it is **not** the Document
Generator: that produces documents *from* estimate and schedule records
(`lib/documents/catalog.ts`). This module is where a document's text is written.

## 1. What it is for

Every firm in the group writes the same twenty or thirty letters over and over:
architectural, interior design, construction, procurement, development. Today
each one lives in somebody's word processor, is copied from the last project,
and carries the wrong client name into the next one. This module holds them as
templates, fills them from what the practice already knows, and keeps what was
sent.

The unit is **one document**. It is numbered, it has a status, it prints on the
practice's letterhead, and it can be emailed.

## 2. The catalogue

`lib/general-documents/catalogue.ts` — pure data, client-safe, 31 entries in five
categories:

| Category | Contains |
|---|---|
| Authorisations | Power of Attorney, Authorisation to Submit, Appointment as Agent, Site Access Authorisation |
| Agreements & intent | Letter of Intent, Mutual NDA, One-way NDA, MOU, Engagement Letter, Subconsultant Engagement |
| Requests | RFI, RFQ, RFP, Prequalification, Material/Sample Approval, Design Approval, Extension of Time |
| Notices & certificates | Notice to Proceed, Practical Completion, Defects Notification, Handover, Suspension, Termination |
| Letters & transmittals | Transmittal, Cover Letter, Permit Submission, Progress Update, Statement of Account, Payment Reminder, Lot Reservation, Purchase Intent |

Each entry declares: a stable `key` (stored on the row, never renamed), a label
and abbreviation, the category, a one-line summary for the picker, the party it
is addressed to when that is not the client, a title template, its **fields**,
its **body** as paragraphs with `{{token}}` placeholders, its **signature
blocks**, and an optional practice note shown in the composer and never printed.

Tokens come from one flat namespace — `{{firmName}} {{clientName}}
{{projectName}} {{counterpartyName}} {{issueDate}} {{effectiveDate}}
{{expiryDate}} {{reference}} …` plus the entry's own field keys. Field values
win, so a template can deliberately shadow a name (a POA's `principalName` is
the client's legal name, which is not always the name the practice files them
under). `lib/general-documents/catalogue.test.ts` fails the build on a token
nothing can fill — a typo like `{{clientNmae}}` would otherwise print a blank
rule on a legal instrument.

An unfilled token renders as `__________`, not as nothing: a power of attorney
that silently drops "until {{expiryDate}}" reads as though it never expires. A
paragraph that would print as nothing but a rule is dropped instead.

## 3. Templates are a starting point, not legal advice

A power of attorney, an NDA and a notice of termination have legal effect. The
bodies in the catalogue are the plain, conventional wording a firm uses day to
day. The composer says, twice, that anything binding should be read by the
practice's own lawyer; the entries where that matters most (POA, NDAs,
suspension, termination) carry their own practice note.

This is also why the **body is editable and then stored on the row**. An issued
document must read the same next year, whatever the catalogue says by then.

## 4. Data model

One table, `general_documents` (`prisma/sql/0015_general_documents.sql`), in
`TENANT_MODELS`:

`number` (`GD-YYYY-NNN`, unique per company, never reused), `docType` (catalogue
key), `status`, `title`, `reference`, `subject`, client and project snapshots,
counterparty name and address, contact name and email, `issueDate`,
`effectiveDate`, `expiryDate`, `signedAt`, `values` (JSON — what was typed),
`body` (`String[]` — the finished paragraphs), `notes`, `supersedesId`,
`voidReason`, author fields, `deletedAt`.

Status: `DRAFT → ISSUED → SIGNED`, plus `SUPERSEDED` and `VOID`.

## 5. What is immutable

- A **DRAFT** may be edited or deleted.
- Anything **issued** may not be edited, and `/[id]/edit` redirects rather than
  rendering a form whose save would be refused.
- An issued document is changed by **superseding** it: a new DRAFT carrying the
  same content and pointing back with `supersedesId`, while the original goes to
  SUPERSEDED and stays readable.
- **Voiding** records that a document no longer applies, with a reason. It never
  erases the text — that is the record of what the practice sent.
- Issuing checks the catalogue's **required fields** and names the empty ones. A
  draft may be half-written; a document that goes out may not.

## 6. Routes

- `/documents/general` — the register: search, status and kind filters
- `/documents/general/new` — the picker, then the composer (`?type=poa` skips the picker)
- `/documents/general/[id]` — the document, its particulars and what can be done to it
- `/documents/general/[id]/edit` — drafts only
- `/print/documents/general/[id]` — the sheet, on the practice's letterhead

The composer shows the letter as it will read, beside the fields, and
"Edit the wording" hands the paragraphs over as plain text. A draft prints with
`DRAFT` beside its number — a document that says nothing about being a draft is
one that gets signed by accident.

Email uses the app's single send path (`EmailButton` → Resend → `EmailLog`),
which sends a signed-in link rather than an attachment, as it does everywhere
else.

## 7. Out of scope for Release A

Counter-signature capture (upload of the signed copy — the permit module's
storage path is the obvious way in), per-firm template overrides, clause
libraries, versioned template history, approval workflow before issue, and
bulk-issuing to several counterparties at once.
