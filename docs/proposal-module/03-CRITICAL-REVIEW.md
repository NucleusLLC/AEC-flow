# Proposal Module — Critical Review (Phase 2)

Adversarial review of `01-PRODUCT-PLAN.md`, `02-TECHNICAL-ARCHITECTURE.md` and
`05-DATA-MODEL.md` before any implementation. Findings are ordered by severity. Several are
criticisms of **my own Phase 1 plan**, and several are contradictions **inside the
specification itself** that need a decision rather than a silent assumption.

Severity key: **BLOCKER** (must resolve before building) · **MAJOR** (changes the plan) ·
**MINOR** (fix during build).

---

## A. Findings that block or reshape the build

### A1 — BLOCKER: The spec requires emailing a PDF, but this stack cannot produce one server-side

The spec requires "Email-ready PDF attachment" and PDF output. This application has **no PDF
library**. Every existing document is an HTML `/print/*` route rendered to PDF *by the user's
browser* via `window.print()`. A browser print dialog cannot produce a file to attach to a
server-sent email.

Closing this needs one of:

| Option | Cost | Notes |
| --- | --- | --- |
| Headless Chrome (`puppeteer`/`playwright`) on the server | High | ~300MB; **does not fit Vercel's serverless functions** without `@sparticuz/chromium` gymnastics. This app deploys to Vercel |
| Hosted render API (Browserless, PDFShift, Doppio) | Low code, ongoing $ | External dependency; proposal content leaves the platform |
| `@react-pdf/renderer` | Medium | React-native-style layout; the print HTML must be re-authored, so two document implementations to maintain — the exact duplication the spec forbids |
| **Email a secure link instead of an attachment** | Lowest | Client clicks through to a tokenised view + online acceptance. Arguably *better* — it enables view tracking and acceptance, which the spec also wants |

**Recommendation:** ship the tokenised-link approach in Release C and treat "PDF attachment"
as deferred. **This is a real deviation from the spec and needs your explicit decision.**

### A2 — BLOCKER: "Do not claim completion until all tests pass" is unsatisfiable today

There is **no test framework** in the repository — no Vitest, Jest, Playwright or Cypress.
The two `npm run` scripts are hand-rolled ts-node assertion scripts. The spec mandates unit,
integration and end-to-end tests.

Adding Vitest is straightforward. Adding E2E (Playwright) is a larger decision: it needs a
seeded test database, auth bypass, and CI. **Recommendation:** add Vitest in Release A
(non-negotiable for a fee engine), defer E2E and say so plainly rather than claiming coverage.

### A3 — MAJOR: Role gating would lock beta testers out of the module

Beta testers self-register through `/signup` and receive the **`STAFF`** role. The spec's
permission matrix gives proposal creation to Administrator / Proposal Manager / Project
Manager — `STAFF` maps most naturally to something below that.

If implemented literally, **every beta tester loses access to the module on day one.**

**Recommendation:** default `STAFF` to full create/edit within their own company for the beta,
gate only `approve`, `configure` and `convert`, and make thresholds opt-in. Ship permissions
permissive-by-default with the structure in place to tighten later.

### A4 — MAJOR: The percentage basis default is arguably wrong for the industry

The spec treats "percentage of total development cost" as a first-class default, and your
original instruction named it first. Conventional AEC practice bases architectural fees on
**estimated construction cost**, not total development cost — development cost includes land,
financing, marketing and developer overhead, none of which the designer's effort scales with.

A 7% fee on construction cost and 7% on development cost can differ by 40–60% on a project
with significant land value. A client comparing proposals will read the higher number as
overpriced unless the basis is stated prominently.

**Recommendation:** support both (as specified), but default to **estimated construction
cost**, always print the basis name and amount directly beside the percentage, and warn when
a development-cost basis is selected without the worksheet completed.

### A5 — MAJOR: The estimate's grand total may be the wrong number to use as a basis

The plan sources the cost basis from the protected Estimates system via `estimateTotals()`.
But that grand total includes **profit % and BBO/overhead %** applied by the estimator, and
possibly general conditions. Basing a design fee on a figure that already contains the
contractor's profit inflates the fee relative to a true construction cost.

**Recommendation:** offer the estimate's `direct` cost and `grandTotal` as *separate*
selectable bases, label them unambiguously, and never auto-pick. The adapter already exposes
both.

### A6 — MAJOR: My own Phase 1 money decision is only half a solution

`02-TECHNICAL-ARCHITECTURE.md` proposes exact integer money inside the proposal engine. That
is correct in isolation, but the **cost basis arrives from Estimates as a float** and the rest
of the app remains float. So the module would be exactly precise about a slightly imprecise
input, and any figure round-tripping through an adapter loses the guarantee at the boundary.

This does not invalidate the decision — allocation and reconciliation errors are the ones that
produce visibly wrong documents, and those are fixed. But the claim must be scoped honestly:
**exactness holds within the proposal, not across the application.** Converting Estimates is
out of scope (it is a protected system).

### A7 — MAJOR: Immutability is asserted but the deployment process undermines it

The plan promises immutable issued versions. Meanwhile the repo's actual deployment practice
is `prisma db push` straight at the **live** Supabase instance holding real tester data, with
no migration history. One `--accept-data-loss` (already needed twice in this codebase) can
destroy the very records immutability is supposed to protect.

**Recommendation:** for this module, reviewable SQL under `prisma/sql/`, applied to a Supabase
branch first, plus a verified backup of `proposals*` tables before the migration. Treat this
as a precondition, not a nicety.

---

## B. Verification against the spec's own checklist

| # | Question | Verdict |
| --- | --- | --- |
| 1 | Workflow reflects real AEC practice | **Mostly.** Missing: subconsultant back-to-back agreements, and fee negotiation rounds before formal revision |
| 2 | Fee logic financially accurate | Yes, once A6 rounding and the override model are implemented |
| 3 | Percentage applied to correct basis | **Only if A4/A5 are resolved.** The mechanism is right; the defaults are the risk |
| 4 | Distinguishes construction cost from development cost | Yes — `CostBasisType` + worksheet + circular guard |
| 5 | Multidisciplinary allocation | Yes — `ProposalDiscipline` + `ProposalFeeComponent` + allocations, validated to reconcile |
| 6 | Revisions preserve history | Yes — append-only `ProposalVersion` snapshots |
| 7 | Accepted proposals locked | Yes — `lockedAt` enforced in the service layer, not just UI |
| 8 | Optional vs base clearly separated | Yes — `optionalServicesTotal` held outside `grandTotal` |
| 9 | Taxes/discounts/retainers/reimbursables correct | Mechanism yes; **tax infrastructure is net-new** (§C1) |
| 10 | Documents understandable to clients | Risk — see C4 |
| 11 | UI avoids overwhelming users | **Contradiction in the spec** — see C3 |
| 12 | Quick proposal without advanced fields | Yes — Quick Proposal is Release A and is the primary path |
| 13 | Can become contract/invoice/budget/scope | Yes — Release D, `ProposalConversion` |
| 14 | Access controls appropriate | See A3 |
| 15 | Multi-currency / tax / language / region | **Partially.** Per-proposal currency yes; cross-currency reporting no; tax net-new; 6-language i18n exists but module bodies are incomplete |
| 16 | Maintainable and extensible | Yes, if the fee engine stays pure and UI stays arithmetic-free |

---

## C. Further findings

### C1 — MAJOR: Tax is entirely net-new, and Aruba may not need it

The application has **zero** tax infrastructure. The spec's tax requirements (multiple taxes,
compound, inclusive/exclusive, exemptions, jurisdictions, rounding rules) are a substantial
subsystem on their own.

Aruba levies BBO/BAVP/BAZV on turnover — relevant, but the rate and treatment for
professional services is a firm-specific question I cannot answer from the codebase.

**Recommendation:** implement single-rate, exclusive-only tax in Release A (name, rate,
registration number, per-line taxable flag). Defer compound/multi-tax/exemptions until a real
requirement exists. Building a full tax engine speculatively is waste.

### C2 — MAJOR: 17 statuses is over-modelled, and two of them cannot be implemented

`Delivered` and `Viewed` require email delivery webhooks and open-tracking. Resend can report
delivery; **view tracking requires a tracking pixel with privacy/legal implications** and is
unreliable (image blocking). Modelling a status the system can never set produces a workflow
that silently stalls.

**Recommendation:** ship `Draft → Internal Review → Approved for Issue → Sent → Under Client
Review → Revision Requested → Revised → Accepted → Rejected → Expired → Withdrawn →
Superseded → Converted`. Add `Delivered`/`Viewed` only alongside real webhook support.

### C3 — MAJOR: The spec contradicts itself on UI complexity

It mandates a 16-step wizard **and** requires that the UI "avoid overwhelming users" and
"avoid requiring advanced fields for a quick proposal". A 16-step wizard is, by construction,
overwhelming — and abandonment rates on long wizards are severe.

**Recommendation:** Quick Proposal is the default entry point and the advertised path.
"Advanced" is a **progressive disclosure of the same proposal** — one editable proposal page
with collapsible sections and a persistent summary rail — not a 16-screen funnel. A user can
open any section at any time, in any order, and save throughout. This satisfies the intent of
both requirements; a literal 16-step wizard satisfies only one.

### C4 — MAJOR: Fee transparency is a commercial decision, not just a UI one

The spec requires the document show "enough detail that both the professional and client can
understand how the fee was calculated". Many practices deliberately **do not** disclose the
percentage or the cost basis, because it invites the client to negotiate the basis.

**Recommendation:** make disclosure a per-proposal toggle (`showFeeDerivation`), defaulting to
showing the basis. The internal copy always shows full derivation regardless.

### C5 — MINOR/MAJOR: Soft deletion will leak without a central filter

The plan adopts `deletedAt`. The codebase has never used soft deletion, and the tenant
extension in `lib/db.ts` does not filter it. Adding `deletedAt` without extending that
extension means deleted proposals appear in lists — a visible bug.

**Recommendation:** extend the client extension once, centrally, exactly as tenancy is done.
Or skip soft deletion for everything except `Proposal` itself.

### C6 — MINOR: `Proposal.refNumber` is globally unique — a real multi-tenant defect

Today two companies cannot both use `PROP-2026-001`. Already noted in the data model; calling
it out here because it is an **existing live bug**, not a new one, and fixing it is a change
to a shipped system that should be done deliberately with its own verification.

### C7 — MINOR: Proposal phases vs project phases will drift

Two phase concepts (commercial vs delivery) are correct domain modelling, but users will
expect editing one to affect the other. Conversion must state clearly that it produces a
one-time snapshot, and the project phase view should link back to its originating proposal.

### C8 — MINOR: AI-assisted scope drafting needs a hard guardrail

`@anthropic-ai/sdk` is present, so this is feasible. But AI-drafted scope becomes
**contractual text**. The spec's own rule — never silently add scope — must be enforced in the
UI: AI output lands in a clearly-marked draft state requiring explicit acceptance per item,
never auto-inserted, and flagged in the audit log as AI-originated.

### C9 — MINOR: Client-facing document language is a bigger lift than it appears

`languageCode` on the proposal implies the *document* renders in the client's language. The
app has 6-language i18n but module bodies are only partially translated, and none of the
proposal's free-text (scope, assumptions, terms) is translatable automatically. Realistically
this means language-specific *template libraries*, not runtime translation.

---

## D. Perspective sweep

- **Architect / Interior Designer:** needs the quick path, phase percentages matching
  practice, and to not disclose margin. Served by Release A + C4.
- **Structural / MEP engineer:** usually a *subconsultant* — needs to issue a proposal *to the
  architect*, and to be represented inside the architect's proposal with markup. Both
  directions are modelled; the back-to-back agreement is not (B, gap #1).
- **Firm principal:** wants win rate, pipeline, margin. Release D.
- **Project manager:** wants accepted proposal → project phases without re-typing. Release D.
- **Financial administrator:** wants the payment schedule to reconcile to the penny and to
  become an invoice schedule. Addressed by exact allocation (A6) — this is precisely why
  integer money matters.
- **Client:** wants a clear, short, professional document. Risk is a 20-section document
  nobody reads; section visibility is configurable for this reason.
- **Database architect:** ~20 new tables on a live DB with no migration history — see A7.
- **Security specialist:** biggest risks are (i) a new model missing from `TENANT_MODELS`,
  (ii) internal margin leaking into a client-facing render. Both need explicit tests.

---

## E. Revisions to the plan resulting from this review

1. Default cost basis → **estimated construction cost**; both estimate `direct` and
   `grandTotal` selectable and labelled; never auto-picked. *(A4, A5)*
2. Replace the 16-step wizard with **Quick Proposal + progressively-disclosed sections**. *(C3)*
3. Permissions ship **permissive** (`STAFF` can create/edit); gate only approve/configure/
   convert. *(A3)*
4. Tax scoped to **single-rate exclusive** in Release A. *(C1)*
5. Status set trimmed to 13 implementable values. *(C2)*
6. PDF-attachment replaced by **tokenised secure link** pending your decision. *(A1)*
7. **Vitest added in Release A**; E2E explicitly deferred. *(A2)*
8. Migration via reviewed SQL + Supabase branch + verified backup. *(A7)*
9. Money exactness scoped honestly to within-proposal. *(A6)*
10. Soft deletion handled centrally in the Prisma extension, or dropped. *(C5)*
11. `showFeeDerivation` toggle added to the data model. *(C4)*

---

## F. Decisions required from you before Release A

1. **A1** — secure link, or add a PDF dependency (and accept the Vercel cost)?
2. **A4** — default basis: estimated construction cost (recommended) or total development cost?
3. **C1** — is tax needed for ZenArch/Aruba now, and at what rate and name?
4. **§3 of the product plan** — absorb the existing Business Development `Proposal`
   (recommended), or keep two separate systems?
5. **A3** — confirm beta testers (`STAFF`) should retain full create/edit access.
