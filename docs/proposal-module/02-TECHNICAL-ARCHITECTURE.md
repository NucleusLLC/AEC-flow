# Proposal Module — Technical Architecture (Phase 1)

Companion to `01-PRODUCT-PLAN.md`. Describes *how* the module is built inside this
repository's existing conventions.

---

## 1. Layering

```
app/(app)/proposals/**          route segments, server components, server actions
components/proposals/**         client components — presentation only, zero money logic
lib/data/proposals*.ts          data access (SERVER-ONLY, tenant-scoped via lib/db.ts)
lib/proposals/engine/**         fee engine — PURE, no I/O, no Prisma, unit-testable
lib/proposals/schema/**         zod schemas — the single validation source
lib/proposals/types.ts          client-safe types (never imports @/lib/db)
lib/integrations/**/adapter.ts  read-only bridges to protected systems
app/print/proposals/**          document rendering, outside the (app) shell
```

The rule the spec insists on — *"do not scatter financial formulas throughout UI
components"* — is enforced structurally: `components/**` may import from
`lib/proposals/engine` but may never contain arithmetic on money. Review checklist item.

---

## 2. Money arithmetic

**This is the most important technical decision in the module, and the current codebase does
it wrong for a financial system.**

Today every module computes money as JavaScript `number` with a local
`round2(n) => Math.round((n + Number.EPSILON) * 100) / 100`. That is binary floating point.
It is adequate for an internal estimate and **not** adequate for a contractual fee document
where phase allocations must reconcile exactly to a total and a payment schedule must sum to
the penny.

### Decision

Introduce a minimal **integer-minor-unit money type** in `lib/proposals/engine/money.ts`:

- Money is carried as an **integer number of minor units** (cents) plus a currency code.
- All addition, subtraction, percentage application and allocation happen on integers.
- Division/allocation uses a **largest-remainder distribution** so a fee split across phases
  always sums exactly to the total — no lost or invented cents.
- Conversion to/from `Prisma.Decimal` happens only at the persistence boundary.

Why not a library: adding `decimal.js` or `dinero.js` is defensible, but the required surface
here is small (add, subtract, multiply-by-rate, allocate, round-half-up) and a dependency-free
integer implementation is fully testable and avoids a new runtime dependency in a module that
must also run in client components for preview. **If review prefers a library, `decimal.js`
is the recommended choice** — this decision is deliberately flagged rather than assumed.

Storage stays `Decimal` in Postgres (Prisma `Decimal`), which is exact; the risk was always in
the JS layer, and that is what this addresses.

### Rounding rules (must be defined, per the spec)

- Percentage fee: `basis_minor × rate` → round **half-up** to minor units.
- Allocation across N parts by percentage: compute each by rounding down, then distribute the
  remaining minor units one at a time to the largest fractional remainders.
- Tax: computed on the taxable subtotal *after* discount, rounded half-up.
- Displayed totals are never re-rounded from displayed components.

---

## 3. The fee engine

`lib/proposals/engine/` — pure functions, no I/O.

```
money.ts        integer money type, allocate(), applyRate()
basis.ts        cost-basis resolution + the development-cost worksheet
methods.ts      one calculator per fee method
engine.ts       compose components → ProposalTotals + warnings + audit trail
```

### Contract

```ts
computeProposal(input: ProposalCalcInput): ProposalCalcResult
```

`ProposalCalcResult` returns, per the spec's requirements:

- line-level results with the **method, inputs and formula** used for each component
- `subtotal`, `discountTotal`, `taxableSubtotal`, `taxTotal`, `grandTotal`
- `optionalServicesTotal` held **separately** — never folded into the base total unless the
  component is explicitly selected
- `warnings[]` — non-blocking (allocation ≠ 100%, payment schedule ≠ total, margin below
  threshold)
- `errors[]` — blocking (negative fee, percentage without basis)
- `auditTrail[]` — ordered human-readable calculation steps for the "how was this
  calculated" panel and the printed fee breakdown

**Determinism:** the same input always yields the same result. No `Date.now()`, no locale
dependence inside the engine. This makes it exhaustively testable.

### Manual overrides

An override never mutates the calculated value. A fee component stores both
`calculatedAmount` and `overrideAmount` (nullable) with `overrideReason`, `overrideBy`,
`overrideAt`. The engine reports both and uses the override for totals while surfacing the
delta. Per the spec: *never silently overwrite a manual fee.*

### Cost-basis change detection

The basis amount is **snapshotted onto the proposal** when set. If the linked estimate later
changes, the module does **not** auto-recalculate; it raises a
`COST_BASIS_DRIFT` warning carrying previous basis, new basis, previous fee, recalculated fee,
difference and percentage change, and requires an explicit user action to accept.

### Circular-fee guard

When the cost basis is *total development cost* and that worksheet includes a
"Professional fees" category, naively applying a percentage is circular. The engine:

1. Detects the overlap.
2. Defaults to **excluding the current proposal's own fee** from its own basis.
3. Offers a documented gross-up alternative `fee = (base × r) / (1 − r)` for `r < 1`.
4. Emits a warning naming which method was applied. Never silently picks one.

---

## 4. Validation

`zod` is already a dependency and currently unused. This module introduces the first real use:
one schema per wizard step, composed into a whole-proposal schema. The **same schema runs in
the server action** — client validation is UX only and never authoritative.

Blocking errors and non-blocking warnings are separate channels; the spec requires the
distinction.

---

## 5. Persistence and tenancy

- Every new company-owned model gets `companyId` and **must** be added to `TENANT_MODELS`
  in `lib/db.ts`. A checklist item and a test assert the two lists agree.
- Multi-row writes (phases, scope items, fee components) run inside
  `prisma.$transaction` so a partially-saved proposal is impossible.
- Header totals are **denormalised** onto `Proposal` for list/dashboard performance and are
  written only by the server after running the engine.

### Immutability of issued versions

`ProposalVersion` rows are append-only snapshots (full JSON of the computed proposal +
rendered document reference). Once a version is issued:

- the header may still advance *status*,
- but scope/fee/terms edits are rejected at the data layer for `ACCEPTED` and any issued
  version, returning a domain error rather than silently succeeding.

Enforcement lives in the service layer, not only the UI.

---

## 6. Documents

Reuses the existing print architecture rather than adding a PDF engine:

- `app/print/proposals/[id]/[versionId]/page.tsx` renders the full document from a **version
  snapshot**, not from live records — so a reissued document is always byte-faithful to what
  the client received.
- Section order/visibility driven by a stored document-structure config, mirroring the
  approach already proven in Sigma's report section-order work.
- Branding from `lib/server/practice-config.ts` (logo, position, size, footer).
- Output is browser print → PDF. **DOCX is deferred** (no library in the stack).
- Every generation registers a row in the existing `GeneratedDocument` register.

Known print-fidelity constraints to design around (already learned in this codebase): tall
content overruns absolutely-positioned footers, and table headers need
`display: table-header-group` to repeat across pages.

---

## 7. Permissions

There is no authorization layer today, so the module introduces a scoped one rather than a
global refactor:

```
lib/proposals/permissions.ts
  can(user, action, proposal) → boolean
```

Actions: `view`, `create`, `edit`, `editFees`, `approve`, `issue`, `accept`, `convert`,
`configure`. Mapped from the existing `UserRole` enum plus proposal ownership. Enforced in
**every server action** (backend is authoritative) and used to hide controls in the UI.

This deliberately does not attempt to retrofit permissions across the rest of the app — that
is a separate, larger piece of work and is recorded as such.

---

## 8. Integration points

| System | Direction | Mechanism |
| --- | --- | --- |
| Clients | read/create | existing `lib/data/clients.ts` |
| Projects | read/create, write at conversion | existing `lib/data/projects.ts` |
| Estimates | **read-only** | `lib/integrations/estimates/adapter.ts` → `grandTotal` as construction-cost basis. Protected system: never write, never recompute |
| ProjectPhase | write at conversion | proposal phases → project phases, one-directional |
| ActivityLog | write | existing `logActivity` for the full audit requirement |
| GeneratedDocument | write | existing register |
| Attachment | read/write | already has `proposalId` |
| Email | send | `lib/server/email.ts` (Resend) — **blocked on a real `RESEND_API_KEY`** |
| Notification | write | approval requests, acceptance, expiry |
| Order | convert | existing `Proposal.order` relation |

---

## 9. Testing strategy

The repo has **no test framework**. The module cannot meet the spec's testing requirements
without one. Recommendation: add **Vitest** (fast, TS-native, no bundler config for pure
modules) scoped initially to `lib/proposals/**`.

- Unit: the fee engine, exhaustively — every method, rounding, allocation, tax, discount,
  override, circular-basis guard.
- Integration: server actions against a test company — create, save draft, approve, issue,
  revise, accept, convert; permission enforcement; version immutability.
- E2E: deferred — no Playwright/Cypress in the stack; adding one is a separate decision.

The existing `npm run golden` regression must keep passing untouched, proving Estimates and
Schedule were not disturbed.

---

## 10. Sequencing (build order)

1. Money type + fee engine + zod schemas (pure, fully tested, zero UI) — **this is the
   foundation and is verifiable before any UI exists**.
2. Schema + migration SQL + `TENANT_MODELS`.
3. Data/service layer + permissions.
4. Quick Proposal route + document + status workflow (Release A ships here).
5. Advanced wizard (Release B).
6. Versioning, approval, email, acceptance (Release C).
7. Conversion, dashboard, reports (Release D).
