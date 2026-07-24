# Proposal Module — Implementation Plan (Phase 2, revised)

This plan incorporates the eleven revisions in `03-CRITICAL-REVIEW.md` §E. It supersedes the
sequencing sketch in `02-TECHNICAL-ARCHITECTURE.md` §10.

## Decisions recorded — 2026-07-24 (Greg)

| # | Decision | Effect on this plan |
| --- | --- | --- |
| §F.4 | **Separate module** — new `ServiceProposal` root; BD `Proposal` untouched | Stage 4 no longer modifies a shipped model. Own status enum, own per-company numbering. Mitigations in `01-PRODUCT-PLAN.md` §3.1 are **mandatory deliverables**, not optional polish |
| §F.2 | **Default basis = estimated construction cost** | Both estimate `direct` and `grandTotal` selectable and labelled; never auto-picked |
| §F.1 | **Tokenised secure link**, not a PDF attachment | No PDF dependency. Client-facing token route + online acceptance land in Release C |
| §F.3 | **Single-rate exclusive tax** | `TaxRate` + per-line taxable flag in Release A. Compound/multi-tax/exemptions deferred |
| §F.5 | *(not asked — proceeding on recommendation)* `STAFF` keeps full create/edit | Permissions ship permissive; `approve`/`configure`/`convert` gated |

**Gate:** Stage 0.1 (dropping the live `architectural_proposals` table) needs explicit
go-ahead. Stages 1–3 are decision-independent and can start immediately.

---

## Stage 0 — Preconditions (no application code)

| # | Task | Why |
| --- | --- | --- |
| 0.1 | Revert the `ArchitecturalProposal` spike; drop `architectural_proposals` from the live DB | Superseded; leaves an unreferenced table in production |
| 0.2 | Verified backup of `proposals`, `proposal_line_items`, `proposal_milestones` | A7 — live tester data, no migration history |
| 0.3 | Add **Vitest** + `npm test`, wired to `lib/**` only | A2 — cannot verify a fee engine without it |
| 0.4 | Confirm `npm run golden` and `verify:calc` pass on a clean tree | Baseline proving Estimates/Schedule untouched |

**Exit:** clean tree, green baseline, test runner available.

---

## Stage 1 — Money primitives (pure, no DB, no UI)

`lib/proposals/engine/money.ts`

- Integer minor-unit money type; `add`, `sub`, `mulRate`, `allocate`, `compare`, format bridge.
- `allocate()` uses largest-remainder so splits always reconcile exactly to the total.
- Conversion helpers to/from `Prisma.Decimal` and `number` at boundaries only.

**Tests (must pass before Stage 2):** allocation of 100 across 3 ways; 1-cent remainders;
negative guards; rate application half-up; a 10,000-iteration property test asserting
`sum(allocate(total, weights)) === total`.

**Exit:** exact-allocation guarantee proven by test.

---

## Stage 2 — Fee engine (pure)

`lib/proposals/engine/{basis,methods,status,engine}.ts`

- `CostBasisType` resolution + development-cost worksheet + **circular-fee guard** with the
  documented exclude-own-fee default and gross-up alternative.
- Fee methods, Release A subset: percentage-of-basis, fixed, and per-phase/discipline
  allocation of either. Remaining 13 methods land in Release B behind the same interface.
- `computeProposal()` → totals, `optionalServicesTotal` held separately, `warnings[]`,
  `errors[]`, `auditTrail[]`.
- Override model: `calculatedAmount` + `overrideAmount` both retained, delta surfaced.
- Status transition map; illegal transitions rejected.

**Tests:** the full unit matrix in `06-TEST-PLAN.md` §1. Includes the spec's own worked
example (§"EXAMPLE CALCULATION") as a fixture, and the multi-discipline 6%/fixed/1.25%/1.75%
case.

**Exit:** engine correct and fully covered with zero UI written.

---

## Stage 3 — Validation schemas

`lib/proposals/schema/*.ts` — zod, first real use in the repo. One schema per section,
composed into a whole-proposal schema, **executed server-side in every action**. Blocking
errors vs non-blocking warnings kept as separate channels.

---

## Stage 4 — Schema + migration

Per the separate-module decision, **no existing model is restructured.**

- New root `ServiceProposal` per `05-DATA-MODEL.md` §1A, with `@@unique([companyId, number])`.
- Release A children only: `ServiceProposalDiscipline`, `ServiceProposalPhase`,
  `ServiceProposalFeeComponent`, `ServiceProposalDevelopmentCostItem`,
  `ServiceProposalPaymentMilestone`, `ServiceProposalTax`, `ServiceProposalStatusHistory`,
  `ServiceProposalVersion`, `DisciplineRef`, `TaxRate`.
  *(Scope items, optional services, reimbursables, discounts, approvals, acceptance, email,
  conversion and template libraries arrive with their releases — not up front.)*
- New enums: `ServiceProposalKind`, `ServiceProposalStatus` (13 values), `CostBasisType`,
  `FeeMethod`, `PaymentTrigger`, `TaxMode`, `DevelopmentCostCategory`. **The live
  `ProposalStatus` enum is not touched.**
- **One** change to a shipped table: nullable `Attachment.serviceProposalId` + relation.
- Register **every** new model in `TENANT_MODELS` (`lib/db.ts`) — asserted by test.
- Reviewable SQL in `prisma/sql/0002_service_proposals.sql`; apply to a Supabase branch first.
- `npx prisma generate` explicitly + delete `tsconfig.tsbuildinfo` (known repo gotcha).

**Exit:** `prisma migrate diff` empty; existing `/proposals` pages **byte-identical** —
verified, since nothing in the BD proposal path was modified.

---

## Stage 5 — Service layer + permissions

- `lib/data/proposals-pro.ts` — reads/writes for the new graph; multi-row writes inside
  `prisma.$transaction`.
- Header totals written **only** by the server after running the engine.
- `lib/proposals/permissions.ts` — `can(user, action, proposal)`. Ships **permissive**:
  `STAFF` may create/edit within their company; `approve`/`configure`/`convert` gated. *(A3)*
- Edit rejection at the data layer for locked/accepted proposals — a domain error, not a UI
  guard.
- `logActivity` on every mutation.

**Tests:** integration — tenant isolation (company B cannot read/update/delete company A's
proposal), locked-proposal rejection, permission enforcement, transaction rollback.

---

## Stage 6 — Release A UI: Quick Proposal

Per C3, **not** a 16-step wizard. One proposal page:

```
Left    section navigator (jump to any section, completion ticks)
Center  the active section
Right   sticky live summary — base fee, optional, reimbursables,
        discount, tax, grand total, payment total, warnings
```

Release A sections: Proposal info · Client & project · Disciplines · Fee basis & fee ·
Phases & allocation · Payment schedule · Terms & validity · Review.

- Autosave drafts.
- All money displayed from the engine; **no arithmetic in components** (review checklist).
- Fee derivation panel showing the audit trail inline.
- `showFeeDerivation` toggle controlling client-facing disclosure. *(C4)*

**Exit:** an architect can produce a complete percentage-based or fixed-fee proposal.

---

## Stage 7 — Release A document

- `app/print/proposals/[id]/page.tsx` extended (existing route) rendering from a **version
  snapshot**, not live records.
- Configurable section order/visibility; branding from `practice-config`.
- Registers a `GeneratedDocument` row.
- Print-fidelity guards: `table-header-group` for repeating headers; avoid the
  absolute-footer overrun already known in this codebase.
- Client-facing render **whitelists fields** — margin, internal cost budget and internal notes
  must be structurally unable to leak. Tested.

**Release A ships here.** Success criteria 1–11 met.

---

## Stage 8 — Release B: commercial depth

Remaining fee methods (hourly, unit rates, retainer, monthly, milestone, cost-plus,
subconsultant markup, hybrid, custom formula); scope-item editor + libraries; deliverables;
optional/additional services; reimbursables; discounts; project-type templates; billing rates;
AI-assisted scope drafting behind the C8 guardrail.

## Stage 9 — Release C: lifecycle

Immutable versioning + revision comparison view; internal approval with configurable
thresholds; email delivery via Resend (**blocked on a real `RESEND_API_KEY`**); tokenised
client link + online acceptance *(pending decision A1)*; partial acceptance of optional
services.

## Stage 10 — Release D: conversion + analytics

Accepted proposal → project, project phases, fee budget, draft invoice schedule, tasks, team
assignments, with a confirmation/mapping screen and duplicate-project warning. Dashboard and
reports with CSV export.

---

## Commit strategy

One commit per stage, each independently green (`tsc`, `eslint`, `npm test`, `npm run golden`,
`next build`). No stage merges with a failing baseline. Stages 1–3 touch no existing file at
all; stage 4 is the first change to shipped behaviour and gets its own review.

---

## Definition of done for Release A

- [ ] All Stage 1–7 tests pass; `npm run golden` unchanged
- [ ] `tsc --noEmit` clean; `eslint` clean; `next build` succeeds
- [ ] Existing `/proposals` list, detail, edit, print unchanged for `kind = SIMPLE`
- [ ] Every new model present in `TENANT_MODELS`, asserted by test
- [ ] Cross-tenant read/write blocked, asserted by test
- [ ] Client-facing document contains no internal financial field, asserted by test
- [ ] Phase allocations and payment schedule reconcile exactly to the total
- [ ] Known limitations documented honestly in `07-CHANGELOG.md`
