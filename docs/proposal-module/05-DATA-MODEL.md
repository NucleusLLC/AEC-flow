# Proposal Module — Data Model (Phase 1)

Companion to `01-PRODUCT-PLAN.md` and `02-TECHNICAL-ARCHITECTURE.md`.

> **SUPERSEDED IN PART — 2026-07-24.** Greg decided the module is **separate** from the
> Business Development `Proposal`. **§1A below is authoritative.** §1 (extending `Proposal`)
> is retained only as the record of the rejected alternative — do not implement it.

**Principle:** a new `ServiceProposal` aggregate root, independent of `Proposal`. The BD
proposal system is not modified. Every new company-owned model must be registered in
`TENANT_MODELS` (`lib/db.ts`) — omission is a cross-tenant data leak.

---

## 1A. `ServiceProposal` — the aggregate root (AUTHORITATIVE)

New model, new table `service_proposals`. Named for the whole module scope (architecture,
interior design, and structural/civil/MEP engineering), not architecture alone.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | |
| `companyId` | `String?` | **Must be added to `TENANT_MODELS`** |
| `number` | `String` | `@@unique([companyId, number])` — per-company from day one |
| `title` | `String` | |
| `kind` | `ServiceProposalKind` | `QUICK` \| `ADVANCED` — drives which sections are required |
| `status` | `ServiceProposalStatus` | Own enum, 13 implementable values (critical review C2). The live `ProposalStatus` is untouched |
| `versionLabel` | `String?` | `"1.0"`, `"2.0"` |
| `revision` | `Int @default(1)` | |
| `clientId` / `clientName` | `String?` | FK to existing `Client`; name denormalised for document fidelity |
| `projectId` / `projectName` | `String?` | FK to existing `Project` |
| `contactName` / `contactEmail` / `contactTitle` | `String?` | Addressee on the document |
| `currency` | `String` | |
| `languageCode` | `String?` | |
| **Cost basis** | | |
| `costBasisType` | `CostBasisType?` | Default `ESTIMATED_CONSTRUCTION_COST` *(decision A4)* |
| `costBasisAmount` | `Decimal?` | Snapshot at calculation time |
| `costBasisSourceId` | `String?` | Estimate id when pulled from Estimates |
| `costBasisSourceField` | `String?` | `"direct"` or `"grandTotal"` — never auto-picked *(A5)* |
| `costBasisCapturedAt` | `DateTime?` | Drives drift detection |
| **Totals** (engine output, server-written only) | | |
| `subtotal` / `discountTotal` / `taxableSubtotal` / `taxTotal` / `grandTotal` | `Decimal @default(0)` | |
| `optionalServicesTotal` | `Decimal @default(0)` | **Never inside `grandTotal`** |
| `reimbursablesTotal` / `retainerAmount` | `Decimal @default(0)` | |
| **Content** | | |
| `scopeSummary` / `exclusions` / `assumptions` / `terms` | `String?` | |
| `estimatedWeeks` | `Int?` | |
| `showFeeDerivation` | `Boolean @default(true)` | Client-facing disclosure toggle *(C4)* |
| `documentStructure` | `Json?` | Section order/visibility |
| **Lifecycle** | | |
| `issuedAt` / `validUntil` / `lockedAt` | `DateTime?` | `lockedAt` set on acceptance; enforced at the data layer |
| `preparedById` / `reviewedById` / `approvedById` / `ownerId` | `String?` | |
| `taxJurisdiction` | `String?` | |
| `notes` | `String?` | Internal only — never rendered client-facing |
| `createdAt` / `createdById` / `updatedAt` / `updatedById` / `deletedAt` | | Soft delete — see §4 caveat |

Indexes: `(companyId, status)`, `(companyId, clientId)`, `(companyId, projectId)`,
`(companyId, createdAt)`.

**One touch to an existing model:** `Attachment` gains a nullable `serviceProposalId` plus
relation. That is the only modification to a shipped table in this module.

---

## 1. Changes to the existing `Proposal` model — REJECTED ALTERNATIVE

> Not implemented. Retained as the record of the option considered and declined on
> 2026-07-24. Child tables in §2 attach to `ServiceProposal`, not `Proposal`.

All additive. Existing rows remain valid.

| Field | Type | Purpose |
| --- | --- | --- |
| `kind` | `ProposalKind` default `SIMPLE` | Discriminator. Existing BD proposals stay `SIMPLE` and render through the existing UI unchanged |
| `versionLabel` | `String?` | e.g. `"1.0"`, `"2.0"` — distinct from the existing integer `revision` |
| `costBasisType` | `CostBasisType?` | Declared basis for percentage fees |
| `costBasisAmount` | `Decimal?` | Snapshot of the basis at time of calculation |
| `costBasisSourceId` | `String?` | Linked estimate id, when sourced from Estimates |
| `costBasisCapturedAt` | `DateTime?` | Used to detect drift against the live estimate |
| `subtotal` / `discountTotal` / `taxableSubtotal` / `taxTotal` / `grandTotal` | `Decimal` default 0 | Denormalised engine output for list/dashboard performance |
| `optionalServicesTotal` | `Decimal` default 0 | Held separately — never inside `grandTotal` |
| `reimbursablesTotal` | `Decimal` default 0 | |
| `retainerAmount` | `Decimal` default 0 | |
| `languageCode` | `String?` | Document language (app has 6-language i18n) |
| `taxJurisdiction` | `String?` | |
| `projectId` | `String?` | Currently absent — proposals link to `Client` only |
| `preparedById` / `reviewedById` / `approvedById` | `String?` | Distinct from the existing `ownerId` |
| `issuedAt` | `DateTime?` | Distinct from the existing `sentAt` |
| `lockedAt` | `DateTime?` | Set on acceptance; blocks edits at the data layer |
| `documentStructure` | `Json?` | Section order/visibility for the generated document |

`totalFee` **keeps its present meaning** so existing dashboard widgets and
`summarizeProposals()` are unaffected.

### Status

The existing `ProposalStatus` enum has 7 values; the spec asks for 17. Extending a live enum
is safe in Postgres (additive), but every existing `switch`/label map must be updated or it
will throw on the new values. Plan: extend the enum, and audit
`PROPOSAL_STATUS_LABEL` plus every consumer in the same commit.

Valid transitions live in `lib/proposals/engine/status.ts` as a transition map — arbitrary
jumps are rejected in the service layer, preserving audit integrity.

---

## 2. New models

> **Naming under the separate-module decision:** every child table below attaches to
> **`ServiceProposal`** via `serviceProposalId`, and is named with the `ServiceProposal`
> prefix (`ServiceProposalPhase`, `ServiceProposalFeeComponent`, …) so it can never be
> confused with the Business Development `Proposal` family. The `Proposal*` names used in the
> tables below are the conceptual names from the rejected alternative; read them as
> `ServiceProposal*`.
>
> This also removes the `ProposalPhase` / `ProjectPhase` collision noted in §C7 of the
> critical review — the new table is `ServiceProposalPhase`, unambiguously distinct.

### Structure

| Model | Purpose | Notes |
| --- | --- | --- |
| `ProposalDiscipline` | One row per discipline on the proposal | Lead, scope, fee method, margin, subconsultant cost, markup |
| `ProposalPhase` | Commercial phases | **Distinct from `ProjectPhase`** — that is delivery. Linked only at conversion |
| `ProposalScopeItem` | Structured scope | discipline, phase, included/excluded, base/optional/additional, responsible party, hours, client-visible vs internal notes |
| `ProposalDeliverable` | Deliverables per phase/discipline | |

### Money

| Model | Purpose | Notes |
| --- | --- | --- |
| `ProposalFeeComponent` | **The core fee row.** One per discipline/phase/service | `method` (`FeeMethod`), inputs, `calculatedAmount`, `overrideAmount?`, `overrideReason`, `overrideBy`, `overrideAt` |
| `ProposalFeeAllocation` | Distribution of a component across phase/discipline/milestone | Percentage or fixed; validated to reconcile |
| `ProposalDevelopmentCostItem` | Total-development-cost worksheet | category, amount, `includedInBasis` bool, notes, source. Drives the circular-fee guard |
| `ProposalPaymentMilestone` | Payment schedule | trigger, percentage, amount, timing, invoice description, tax treatment, retainage |
| `ProposalOptionalService` | Optional/additional services | `selected` bool, client acceptance state, schedule impact |
| `ProposalReimbursable` | Reimbursable expenses | billing method (at cost / cost+markup / allowance / NTE / client-direct) |
| `ProposalDiscount` | Discounts | type, amount/percentage, reason, authorisedBy, authorisedAt, `visibleToClient` |
| `ProposalTax` | Applied taxes | name, rate, inclusive/exclusive, compound flag, registration number, exemption |

**Original values are always preserved.** Discounts and overrides never mutate the calculated
figure — both are stored.

### Content

| Model | Purpose |
| --- | --- |
| `ProposalAssumption` | Assumptions (from library or ad-hoc) |
| `ProposalExclusion` | Exclusions |
| `ProposalClientResponsibility` | Client responsibilities |
| `ProposalTerm` | Terms, ordered, per-proposal snapshot of the library text |

Terms are **snapshotted onto the proposal**, not referenced by FK — editing the firm's terms
library must never retroactively change an issued proposal.

### Lifecycle

| Model | Purpose | Notes |
| --- | --- | --- |
| `ProposalVersion` | **Immutable snapshot** of an issued proposal | Full computed JSON + document reference. Append-only |
| `ProposalStatusHistory` | Every transition | from, to, by, at, reason |
| `ProposalApproval` | Internal review | reviewer, role, state, comments, threshold that triggered it |
| `ProposalAcceptance` | Client acceptance | accepted version, name, title, date, signature/upload, PO number, selected optional services, comments, verification metadata |
| `ProposalEmail` | Delivery record | to/cc/bcc, subject, attachments, provider id, delivery status |
| `ProposalComment` | Internal discussion |
| `ProposalConversion` | What an accepted proposal became | project/contract/invoice-schedule ids, mapping, converted by/at |

`ActivityLog` (existing) remains the general audit trail; these tables hold the structured,
queryable commercial record.

### Libraries / configuration

| Model | Purpose |
| --- | --- |
| `ProposalTemplateV2` | Project-type templates (scope + phases + fees + terms) |
| `ScopeTemplate` / `PhaseTemplate` / `TermsTemplate` | Reusable libraries |
| `FeeSchedule` | Percentage bands by project type / cost range |
| `BillingRate` | Role/discipline hourly rates, effective-dated |
| `DocumentTemplate` | Section order, branding overrides |
| `TaxRate` | **Net-new** — the app has no tax infrastructure at all |

`ProposalTemplate` (existing, referenced by `Proposal.templateId`) is left in place; the new
richer template is a separate model to avoid breaking the current relation.

---

## 3. New enums

`ProposalKind`, `CostBasisType`, `FeeMethod`, `FeeAllocationBasis`, `PaymentTrigger`,
`ServiceCategory` (base/optional/additional), `ReimbursableMethod`, `DiscountType`,
`TaxMode` (inclusive/exclusive), `ApprovalState`, `AcceptanceMethod`, `DevelopmentCostCategory`.

### Discipline problem

Existing `Discipline` has 6 values and `DesignDiscipline` has 3. The spec lists ~20.

**Recommendation: a `DisciplineRef` lookup table**, seeded with the 20, rather than a third
enum. Enums are cheap to add to but impossible for a firm to extend at runtime, and different
practices use different discipline sets. Existing enum columns stay where they are.

---

## 4. Standard columns

Per the spec, primary entities carry: `id`, `companyId`, `createdAt`, `createdById`,
`updatedAt`, `updatedById`, `deletedAt` (soft delete), and where relevant `version`/`status`.

Note the current codebase does **not** use soft deletion anywhere, and the tenant extension
in `lib/db.ts` has no `deletedAt` filter. Introducing soft deletes means either filtering in
every query or extending the client extension. **Recommendation: extend the existing
extension once**, so it is handled centrally like tenancy — otherwise deleted rows will leak
into lists.

---

## 5. Indexing

- `Proposal`: `(companyId, status)`, `(companyId, clientId)`, `(companyId, projectId)`,
  `(companyId, createdAt)` for dashboard/pipeline queries.
- Children: `(proposalId)` on all, plus `(proposalId, sortOrder)` where ordered.
- `ProposalVersion`: `(proposalId, versionLabel)` unique.
- `ProposalStatusHistory`: `(proposalId, createdAt)`.

`Proposal.refNumber` (the **existing BD model**) is `@unique` **globally**, not per company —
two companies cannot both have `PROP-2026-001`. That is a live multi-tenant defect.

Under the separate-module decision this is **out of scope**: `ServiceProposal.number` uses
`@@unique([companyId, number])` from the start, matching `PurchaseOrder`, `MaterialSelection`
and `DesignDeliverable`. The BD defect remains and is logged as pre-existing work, not
silently inherited or silently fixed.

**Caveat already proven in this codebase:** `@@unique([companyId, x])` does not dedupe when
`companyId` is NULL, because Postgres treats NULLs as distinct. Script-inserted rows bypass
it; in-app writes always carry a companyId.

Proposal numbers must never be reused after void/delete — the generator reads the high-water
mark including soft-deleted and voided rows.

---

## 6. Migration approach

1. Write reviewable SQL under `prisma/sql/0002_proposal_module.sql` (pattern already used for
   Nucleus licensing) rather than relying on `prisma db push` alone.
2. Apply to a branch/staging database first. The live Supabase instance holds real beta
   tester data.
3. Backfill: existing `Proposal` rows get `kind = 'SIMPLE'`; totals backfilled from
   `totalFee`; no other change.
4. Verify `prisma migrate diff` is empty (schema ↔ DB in sync) before proceeding.
5. Regenerate the client explicitly and delete `tsconfig.tsbuildinfo` — a known gotcha in
   this repo where stale build info produces phantom type errors.

---

## 7. Cleanup required before implementation

The earlier spike created an `ArchitecturalProposal` model and **pushed an
`architectural_proposals` table to the live database**. It is empty and unreferenced. It is
superseded by this data model and should be dropped, with the spike's files reverted.
