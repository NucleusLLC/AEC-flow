# Proposal Module — Product Plan (Phase 1)

**Status:** Phase 1 planning. No implementation has begun.
**Author:** Claude Code session, 2026-07-24
**Target module:** Module 1 — Architecture & Engineering Design (with cross-module reach)
**Version domain:** follows `MODULE_VERSION` in `lib/modules.ts` (currently `Beta V0.015`)

---

## 1. What this module is

A proposal-management system for AEC practices — architects, interior designers, and
structural/civil/mechanical/electrical/plumbing engineers — that produces professional
service proposals and carries them through their full commercial lifecycle:

> draft → internal review → issue → client response → acceptance → conversion into a live project

It is **not** a quotation generator. The distinguishing requirements are:

- Fees derived from a **declared cost basis** (percentage of construction or total
  development cost), not just typed in.
- **Multidisciplinary** proposals where several disciplines each carry their own scope,
  phases, fee method and margin, reconciling to one client-facing total.
- **Immutable issued versions** — an issued proposal is a commercial document and must never
  be silently altered.
- **Conversion** of an accepted proposal into project scope, phases, budget and an invoice
  schedule.

---

## 2. Existing application — inspection findings

### 2.1 Stack

| Area | Finding |
| --- | --- |
| Framework | Next.js **16.2.3**, App Router, React **19.2.4**, TypeScript 5 |
| ORM / DB | Prisma **7.7** with `@prisma/adapter-pg` → Supabase Postgres (`zouzxwuojnsyjvadvldr`) |
| Auth | NextAuth 4 credentials; `AUTH_ENFORCE` env gates the whole app in `proxy.ts` |
| Styling | Tailwind **v4** (`@tailwindcss/postcss`), semantic CSS custom-property tokens |
| Forms | `react-hook-form` + `@hookform/resolvers` (older modules); newer modules use plain `useState` + server actions |
| Charts | `recharts` |
| Email | `resend` via `lib/server/email.ts` |
| AI | `@anthropic-ai/sdk`, used in `settings/actions.ts` and `estimates/wiki-actions.ts` |
| Validation | `zod` **is a dependency but is imported in zero files** |
| Money | **No decimal library.** All money is JS `number` + ad-hoc `round2()` helpers |
| PDF / DOCX | **None.** Documents are `/print/*` HTML routes + browser `window.print()` |
| Tests | **No test framework.** Two ts-node scripts: `npm run golden`, `npm run verify:calc` |

### 2.2 Database

68 models, 58 enums. Directly relevant to this module:

- **`Client`** + `ClientAddress` — client records with addresses, tax id, status/type enums.
- **`Project`** — projects, with **`ProjectPhase`** / `PhaseAssignment` / `PhaseDependency`
  already modelling phases, sub-phases, discipline, dates, progress and deliverables (as a
  string). **The proposal module must feed this, not duplicate it.**
- **`Proposal`** + `ProposalLineItem` + `ProposalMilestone` + `ProposalTemplate` — an
  **existing Business Development proposal system** with line items, milestones, statuses,
  revision counter, and an `Order` conversion path. See §3 — this is the single biggest
  design decision in the module.
- **`CostEstimate`** / `EstimateCategory` / `EstimateItem` — the protected Estimates system;
  the authoritative source of estimated construction cost.
- **`ActivityLog`** — generic audit rows (`action`, `entityType`, `entityId`, `meta` JSON),
  already wired into 7 module mutation paths.
- **`GeneratedDocument`** — document register recording source system/record/version.
- **`Attachment`** — already carries a `proposalId` FK.
- **`Company`** — the tenant. `companyId` on 27 models, scoped centrally in `lib/db.ts`.
- **`Notification`**, **`Order`**, **`Task`** — downstream conversion targets.

### 2.3 Conventions that must be followed

- **Tenant isolation is centralised** in a Prisma client extension in `lib/db.ts` via a
  `TENANT_MODELS` set. Every new company-owned model must be added there — that is the only
  place scoping is applied. Note `findUnique` is guarded post-hoc; single-row writes append
  `companyId` to the unique where.
- **Client-safe type split.** Any module with client components splits types into a sibling
  `*.types.ts` that never imports `@/lib/db`. Established across proposals, estimates,
  procurement, materials, design.
- **Server actions, not REST.** Newer modules (documents, invites, procurement, materials,
  design) use `app/(app)/<m>/actions.ts` with `"use server"` + `revalidatePath`. The dead
  REST write routes were deliberately removed in June.
- **Pure calc modules.** `lib/<domain>/calc.ts` holds money math with no I/O so server and
  client share one implementation (`lib/procurement/calc.ts`, `lib/estimates/calc.ts`).
- **Print routes** live outside the `(app)` shell at `app/print/**` and are the document
  system. `CaPrintShell` is the reusable letterhead wrapper.
- **Protected systems.** Estimates and Schedule are declared integration-only in
  `docs/protected-systems.md`. Read them through `lib/integrations/*/adapter.ts`, which
  reuses their own calculations and never recomputes.

### 2.4 Configuration and branding

`lib/server/practice-config.ts` provides practice profile, logo (data URL, position, size),
document footer, and a single org-wide ISO **currency**.

**There is no tax configuration anywhere in the application** — no tax model, no rate, no
jurisdiction, no registration number. The spec's tax requirements are net-new infrastructure.

### 2.5 Permissions

`UserRole` enum exists (`ADMIN`, `DIRECTOR`, `MANAGER`, `STAFF`, `VIEWER`) and `Department`
(`DESIGN`, `ENGINEERING`, `MANAGEMENT`, `ADMIN`, `FINANCE`). But role is referenced in only
7 files — team, leave, settings, admin, founder. **There is no general authorization layer.**
Route protection today is binary: authenticated or not, plus founder-gating on `/admin`.
`canAccess()` in the estimates adapter is a stub returning `true`.

---

## 3. The central design decision: extend `Proposal`, or build new?

> **DECIDED 2026-07-24 (Greg): build a SEPARATE module.** The recommendation below argued for
> absorbing the existing `Proposal`. It was **not adopted**. §3.1 records the decision, the
> reasoning in its favour, and the mitigations now mandatory. The analysis is retained
> because the trade-offs it names are real and will resurface in reporting and navigation.

The application already has a `Proposal` model under Business Development, with templates,
line items, milestones, attachments, activity logging, print output and conversion to `Order`.

**Recommendation (NOT ADOPTED): extend and absorb, do not build a parallel system.**

Rationale:

- Two entities both called "proposal" is a permanent usability and reporting defect. Users
  would ask "which proposals list?" forever, and firm-wide win-rate reporting would be split.
- `Attachment.proposalId`, `Order.proposal`, `ProposalTemplate` and the activity log already
  point at the existing model. A second system orphans all of it.
- The spec's own §"IMPLEMENTATION SAFEGUARDS" forbids duplicate systems and duplicate
  document generation.

Shape of the recommendation:

1. Keep `Proposal` as the **header/aggregate root** — it already holds ref number, client,
   owner, status, revision, currency, validity, terms, and the `Order` link.
2. Add the new dimensions as **related tables** (disciplines, phases, scope items, fee
   components, cost basis, payment milestones, optional services, reimbursables, discounts,
   taxes, versions, approvals, acceptance).
3. Treat existing `ProposalLineItem` / `ProposalMilestone` as the **legacy simple path** —
   retained, still readable, with the new fee engine able to represent them. Migrate rather
   than orphan.
4. Add a `ProposalKind` discriminator (`SIMPLE` | `PROFESSIONAL_SERVICES`) so the existing
   Business Development flow keeps working byte-identically while the new wizard drives the
   richer kind.

**Risk to state plainly:** `Proposal` is live, seeded, tenant-scoped, and used by real beta
testers. Every change to it is a change to a working system. The mitigation is that all new
fields are nullable/defaulted and all new data lives in new tables, so existing rows and the
existing UI remain valid. This is why the model is *extended*, never restructured.

**The earlier `ArchitecturalProposal` spike** (model + `architectural_proposals` table pushed
to the live DB, plus calc/data/component files, uncommitted) is superseded and should be
reverted and the table dropped — see §3.1, which supersedes it with a properly-scoped root
entity.

---

### 3.1 DECISION: separate module (adopted)

**Chosen:** a new root entity, `ServiceProposal`, independent of the Business Development
`Proposal`. The existing BD proposal system is **not touched at all**.

Named `ServiceProposal` rather than `ArchitecturalProposal` because the module serves
interior designers and structural/civil/MEP engineers equally — the spike's name was too
narrow for the specification's scope.

**What this buys:**

- **Zero regression risk** to a live system real beta testers use daily. No change to
  `Proposal`, `ProposalLineItem`, `ProposalMilestone`, `ProposalTemplate` or their UI.
- No enum surgery on the live `ProposalStatus` (the 7 → 13 value extension is avoided
  entirely — the new module gets its own status enum).
- The live `Proposal.refNumber` global-uniqueness defect (§C6 of the critical review) can be
  left alone rather than fixed under pressure; the new module gets
  `@@unique([companyId, number])` from day one.
- Stage 4 no longer modifies a shipped model, so the riskiest migration in the plan disappears.

**What this costs, and the required mitigations:**

| Cost | Mitigation (now mandatory) |
| --- | --- |
| Two things called "proposal" | **Naming discipline.** New module is "Service Proposals" in Module 1; the BD one stays "Proposals" under Business Development. Never both labelled "Proposals" in the same nav |
| Split win-rate / pipeline reporting | Release D reports read **both** sources and label them; a combined pipeline view is a stated Release D requirement, not an afterthought |
| `Attachment.proposalId` doesn't reach the new entity | Add a nullable `serviceProposalId` to `Attachment` — the one unavoidable touch to an existing model. `Attachment` has no `companyId`, so it is scoped through its parent |
| `Order` conversion path not reused | Release D conversion targets `Project`/`ProjectPhase` directly; converting to `Order` is available later via the same mapping screen |
| Duplicate document generation risk | **Forbidden.** The new document reuses `CaPrintShell`, `practice-config` branding and the existing `GeneratedDocument` register. No second document system |
| Users may create the same proposal in both places | Release A adds a hint on the BD proposal list pointing at Service Proposals for fee-based professional services |

**Consequence for the data model:** `05-DATA-MODEL.md` §1 (extending `Proposal`) is superseded
by §1A (the `ServiceProposal` root). All child tables in §2 attach to `ServiceProposal`.

---

## 4. Scope: what ships, and in what order

The full specification is very large. It is planned in four releases so that each is
independently useful and reviewable, rather than one unreleasable mega-branch.

### Release A — Quick Proposal (the usable core)
Client + project + one or more disciplines, fee by percentage-of-cost-basis or fixed fee,
phase allocation, payment schedule, tax, validity, terms; preview; print document; status
workflow; audit log. **This alone satisfies success criteria 1–11.**

### Release B — Advanced wizard and commercial depth
16-step wizard, scope-item editor with libraries, deliverables, optional/additional services,
reimbursables, discounts, hourly and unit-rate fee methods, hybrid fees, templates.

### Release C — Lifecycle
Immutable versioning and revision comparison, internal approval thresholds, email delivery
and tracking, client acceptance (including partial acceptance of optional services).

### Release D — Conversion and analytics
Conversion to project/phases/budget/invoice schedule, dashboard, reports, exports.

### Explicitly deferred (documented, not silently dropped)
- Electronic-signature integration — no provider in the stack; acceptance is manual/uploaded.
- DOCX output — no library; would add a dependency. HTML/PDF-via-print ships first.
- Email *view* tracking — requires a tracking pixel/redirect service and has legal
  implications; delivery status only in Release C.
- Multi-currency FX conversion — the app has one org currency; per-proposal currency is
  supported, cross-currency roll-up reporting is not.

---

## 5. System-impact analysis

### 5.1 Files to be created (new, additive)

```
lib/proposals/                     types, calc engine, money, validation schemas
lib/data/proposals-pro.ts          data access for the extended entities
app/(app)/proposals/…              wizard, editors, dashboard routes
components/proposals/…             wizard steps, fee editor, summary rail
app/print/proposals/[id]/…         document renderer (extends existing print route)
docs/proposal-module/*.md          this documentation set
```

### 5.2 Files to be modified (existing — each a deliberate, reviewed change)

| File | Change | Risk |
| --- | --- | --- |
| `prisma/schema.prisma` | extend `Proposal`, add ~20 related models + enums | Medium — additive only, all new fields nullable/defaulted |
| `lib/db.ts` | add new models to `TENANT_MODELS` | Low, but **omission is a data-leak bug** |
| `lib/nav.ts` | Proposals section expanded | Low |
| `lib/modules.ts` | Proposals added to Module 1 nav | Low |
| `lib/data/proposals.ts` / `.types.ts` | additive exports; existing exports untouched | Medium — read by the live BD module |
| `components/shell/*` | module identity panel already shows module/version/company/user | Low — verify role display |
| `prisma/seed.ts` | proposal templates, fee schedules, billing rates | Low |

### 5.3 Database migrations

New tables (see `05-DATA-MODEL.md`), all additive. Existing `Proposal` gains nullable columns
and a defaulted `kind` discriminator. **No column is renamed or dropped.**

Deployment note: the project uses `prisma db push` against a live Supabase instance, not a
migration history. For a change of this size, a reviewable SQL file under `prisma/sql/`
(as done for `0001_nucleus_licensing.sql`) is the safer pattern, with `db push` used only
after the diff is inspected.

### 5.4 Reusable existing functionality (do not rebuild)

Clients, Projects, `ProjectPhase`, Estimates (via adapter, for cost basis), `ActivityLog`,
`GeneratedDocument`, `Attachment`, `Notification`, Resend email, practice/branding config,
`CaPrintShell`, `Badge`/`Card`/`ProgressBar`, tenant scoping, `formatCurrency`.

### 5.5 Conflicts and duplication risks

1. **Two proposal systems** — resolved by §3.
2. **Two phase systems** — `ProjectPhase` (delivery) vs proposal phases (commercial). These
   are legitimately different lifecycle stages; the link is one-directional at conversion.
   Must be documented so they don't drift.
3. **Two document registers** — `GeneratedDocument` exists; proposal documents must register
   there rather than inventing a second register.
4. **Discipline enums** — `Discipline` (6 values) and `DesignDiscipline` (3) already exist and
   are too narrow for the spec's 20 disciplines. Extending `Discipline` affects existing rows;
   a new lookup table is safer than a third enum.

### 5.6 Security considerations

- Every new model must enter `TENANT_MODELS`, or it leaks across companies. This is the
  highest-severity risk in the module.
- Fees, margins, internal cost budgets and discounts are confidential. Client-facing document
  rendering must whitelist fields, never spread a full record.
- Acceptance metadata (IP, timestamps) is evidential — write-once.
- `/print/*` routes are auth-gated today; a future client-facing acceptance link needs a
  scoped token route, not an open print URL.
- Authoritative calculation must be server-side; client math is preview only.

### 5.7 Performance considerations

A proposal with disciplines × phases × scope items × fee components is a deep graph. List and
dashboard queries must use stored aggregate totals on the header rather than loading and
recomputing children. The fee engine returns a full breakdown; the header caches the totals.

### 5.8 Backward-compatibility risks

- Existing `Proposal` rows have no disciplines/phases — every reader must tolerate empty
  collections.
- The existing `/proposals` list, detail, edit and print pages must render unchanged for
  `kind = SIMPLE`.
- `summarizeProposals()` and the existing dashboard widgets read `totalFee`; that field must
  keep its current meaning.

---

## 6. Open questions for the firm

These change the build materially and are flagged rather than assumed:

1. **Does the existing Business Development `Proposal` get absorbed (recommended) or left
   alone with a separate professional-services module?**
2. **Which cost basis is the firm's default** — estimated construction cost, or total
   development cost?
3. **Is tax actually required for Aruba/ZenArch operations**, and at what rate/name? This
   determines whether tax is Release A or deferred.
4. **Are approval thresholds needed at ZenArch's size**, or is single-approver sufficient
   for the beta?
5. **Do proposals need to be client-viewable online** (portal link + online acceptance), or is
   email-a-PDF plus manual acceptance sufficient?
