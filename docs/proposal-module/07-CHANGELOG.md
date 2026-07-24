# Proposal Module — Changelog

Module version domain: `MODULE_VERSION` in `lib/modules.ts` (`Beta V0.015` at time of writing).
Nothing in this module is committed or deployed yet.

---

## 2026-07-24 — Phases 1 & 2 complete; Stages 0–2 implemented

### Planning (Phase 1)
- `01-PRODUCT-PLAN.md` — inspection findings, scope in four releases, system-impact analysis.
- `02-TECHNICAL-ARCHITECTURE.md` — layering, money strategy, engine contract, permissions.
- `05-DATA-MODEL.md` — entity design.

### Critical review (Phase 2)
- `03-CRITICAL-REVIEW.md` — 2 blockers, 9 major findings, 16-point verification, perspective sweep.
- `04-IMPLEMENTATION-PLAN.md` — revised 10-stage plan incorporating the review.
- `06-TEST-PLAN.md` — unit/integration/document coverage; E2E explicitly deferred.

### Decisions taken (Greg, 2026-07-24)
| Decision | Outcome |
| --- | --- |
| Absorb the BD `Proposal` vs separate module | **Separate module** (`ServiceProposal`) — against the written recommendation; mitigations in `01-PRODUCT-PLAN.md` §3.1 are now mandatory |
| Default cost basis | **Estimated construction cost** |
| Client delivery | **Tokenised secure link**, not a server-generated PDF attachment |
| Tax scope | **Single-rate, exclusive** in Release A |
| `STAFF` permissions | Retain full create/edit (proceeding on recommendation) |

### Implementation

**Stage 0 — preconditions**
- Dropped the superseded `architectural_proposals` table and its two enums from the live
  database (`prisma/sql/0002_drop_architectural_proposals_spike.sql`), applied through a
  guarded runner that refused to proceed if the table held rows. It held none.
  Deliberately **not** done via `db push --accept-data-loss`, which would have dropped
  anything else that had drifted.
- Reverted the spike's files. `prisma migrate diff` confirms schema and database are in sync.
- Added **Vitest** (`npm test`), scoped to `lib/proposals/**`.

**Stage 1 — money primitives** · `lib/proposals/engine/money.ts`
- Integer minor-unit money type; all arithmetic on integers.
- `allocate()` uses largest-remainder distribution so a split always sums exactly to the total.
- 28 tests including a 10,000-iteration property test.

**Stage 2 — fee engine** · `basis.ts`, `engine.ts`, `status.ts`, `types.ts`
- Cost-basis resolution with the total-development-cost **circular-fee guard**
  (exclude-own-fee default, documented gross-up alternative, divergence blocked at r ≥ 1).
- Percentage-of-basis and fixed-fee methods; the remaining 9 method types are declared and
  report `METHOD_NOT_IMPLEMENTED` rather than silently returning zero.
- Optional services held outside the grand total until selected; additional services never
  counted. Discounts preserve the original figure. Exclusive and inclusive tax, with
  non-taxable lines excluded and the discount apportioned exactly across taxable lines.
- Manual overrides never destroy the calculated value; an override without a reason blocks.
- Phase and payment-schedule allocation reconcile exactly when balanced, and leave the
  shortfall visible when not.
- Status workflow with an explicit transition map; 13 implementable statuses.
- 47 tests, including the specification's worked examples reproduced exactly.

### Verification at this point
| Check | Result |
| --- | --- |
| `npm test` | **75 passed** (3 files) |
| `npx tsc --noEmit` | clean (exit 0) |
| `npx eslint lib/proposals` | clean, 0 warnings |
| `npm run golden` | passes — protected Estimates/Schedule outputs unchanged |
| `prisma migrate diff` | no difference — schema ↔ live DB in sync |

### Known limitations at this point
- No database schema, service layer or UI yet — Stages 4–7.
- Fee methods beyond percentage and fixed are declared but not implemented (Release B).
- Exactness is guaranteed **within** a proposal; a cost basis imported from the protected
  Estimates system arrives as a float and may carry imprecision this module cannot undo.
- E2E testing deferred — no browser-test tooling in the stack.
- Email delivery remains blocked on a real `RESEND_API_KEY` (currently `"placeholder"`).

### Correction to an earlier statement in this session
Phase 1 recorded "no test framework — two hand-rolled ts-node scripts". No framework is
installed in `package.json`, which is accurate, but the repository does contain two genuine
`node:test` suites (`lib/calc/rebar.test.ts`, `lib/development/calc.test.ts`) run via
`tsx --test`. Vitest's include glob is scoped to `lib/proposals/**` so the two conventions
do not collide. Consolidating them is worthwhile but belongs to separate work.

---

## 2026-07-24 (cont.) — Stages 3 & 4

**Stage 3 — validation** · `lib/proposals/schema/proposal.ts`
- First use of `zod` in the codebase. One schema per section, composed into
  `serviceProposalInputSchema`, run authoritatively in the server action.
- Structural validity (blocking) kept separate from the engine's financial warnings
  (non-blocking) — a draft can be saved with warnings, but not issued.
- A compile-time `expectTypeOf` check asserts the schema output feeds the engine with no
  adaptation layer. 16 tests.

**Stage 4 — schema + migration** · first database change since the spike drop
- Added `ServiceProposal` root + 10 child tables + `TaxRate`, and 6 enums, to
  `schema.prisma`. One touch to an existing table: nullable `Attachment.serviceProposalId`
  with an `ON DELETE SET NULL` FK.
- Generated the migration from Prisma's own diff → `prisma/sql/0003_service_proposals.sql`:
  **12 CREATE TABLE, 6 CREATE TYPE, 12 FK ALTER, 0 DROP** — verified additive before running.
- Applied to the live database inside a single transaction via a one-shot guarded runner
  (deleted after use). Public tables 66 → 78; `Attachment.serviceProposalId` confirmed.
  `prisma migrate diff` now reports no difference — schema ↔ DB in sync.
- Registered all 12 new models in `TENANT_MODELS` (`lib/db.ts`).
- `lib/proposals/tenant-scope.test.ts` reads `lib/db.ts` and `schema.prisma` and fails the
  build if any `companyId`-bearing model is missing from `TENANT_MODELS`. It surfaced four
  pre-existing deliberate exclusions (`AppConfig`, `User`, `Invitation`, `BetaCode` — all
  scoped by hand because they operate pre-session); these are documented in an allowlist so
  the guard still catches genuinely new omissions.

### Verification after Stage 4
| Check | Result |
| --- | --- |
| `npm test` | **93 passed** (5 files) |
| `npx tsc --noEmit` | clean |
| `npm run golden` | passes — protected outputs unchanged |
| `prisma migrate diff` | no difference — schema ↔ live DB in sync |

---

## 2026-07-24 (cont.) — Stage 5: service layer + permissions

**Permissions** · `lib/proposals/permissions.ts` (client-safe)
- `can(actor, action, subject)` — the module's own scoped authorization, since the app has no
  general one. Permissive per decision A3: STAFF (the beta default) gets the full day-to-day
  workflow; only approve/convert/configure are gated to MANAGER/DIRECTOR/ADMIN.
- Status-driven hard rules apply regardless of role: an accepted/converted/superseded
  proposal cannot be edited or deleted, even by an admin.
- Same function drives server enforcement (authoritative) and UI control visibility. 12 tests.

**Service layer** · `lib/data/service-proposals.ts` (server-only) + `lib/proposals/persist.ts` (pure)
- Full CRUD: create/update/soft-delete, status transitions, issue (with immutable version
  snapshot), and revise (fresh draft, supersedes the issued original).
- Every monetary figure — header totals and each child row's amount — is written from the
  engine, never from the client. `buildWriteData` (pure, in `persist.ts`) does that wiring
  and is unit-tested directly. Multi-row writes run in `prisma.$transaction`.
- Immutability enforced at the data layer: editing or deleting a locked proposal throws
  `ProposalLockedError`; illegal status transitions throw from the engine's transition map.
- Soft delete via `deletedAt`; numbering (`SP-{year}-{NNN}`) reads all rows incl. deleted so
  a number is never reused.
- 10 wiring tests + the money/engine tests they build on.

**Bug caught during the stage:** after extracting the pure mapping, `validUntil` (which the
schema permits as `""`) was being passed to Prisma as an empty string — an invalid DateTime
that would throw at runtime. Fixed to normalise to `null`, with two regression tests.

### Scope note — live-DB integration is a named gap
The tenant extension scopes by the *session's* company, so true cross-tenant isolation and
create→issue→lock→delete round-trips can only be exercised with a session mock against a
dedicated test database. Neither exists in this repo, and writing to the live Supabase
instance (real beta data) from an automated test is not acceptable. That coverage is provided
instead by: (a) the static `tenant-scope.test.ts` guard proving every model is centrally
scoped, (b) the pure wiring/permission/transition tests, and (c) the manual checklist in
`06-TEST-PLAN.md` §5. A session-mocked DB harness is deferred and recorded here as the gap.

### Verification after Stage 5
| Check | Result |
| --- | --- |
| `npm test` | **117 passed** (7 files) |
| `npx tsc --noEmit` | clean |
| `npx eslint lib/proposals lib/data/service-proposals.ts` | clean, 0 warnings |
| `npm run golden` | passes — protected outputs unchanged |

---

## 2026-07-24 (cont.) — Stages 6 & 7: Quick Proposal UI + document + nav — **RELEASE A USABLE**

**Server actions** · `app/(app)/design/service-proposals/actions.ts`
- create / update / delete / issue / transition / revise, each permission-checked server-side
  via `assertCan`. Payloads pass through the zod schema (`parseServiceProposalInput`) before
  the data layer sees them. A missing session resolves to VIEWER, so an absent session can
  only reduce privilege, never grant it.

**Quick Proposal form** · `components/service-proposals/service-proposal-form.tsx`
- One page with a sticky **live summary rail**. The rail calls the SAME `computeProposal`
  the server persists with — the preview equals the stored total by construction.
- Sections: proposal + client/project, cost basis (shown only when a percentage fee exists),
  fee lines (%/fixed, base/optional/additional), design phases (default 10/15/35/40, editable
  with live 100% check), payment schedule, tax + discount, scope/terms. Blocking errors and
  non-blocking warnings surface live in the rail.

**List / detail / edit** · under `app/(app)/design/service-proposals/`
- List with status filter + pipeline tiles (total, open, open value, win rate).
- Detail recomputes from the stored input (deterministic → matches stored totals), shows the
  fee breakdown, phases, payment schedule and status actions; edit is hidden and blocked for
  locked proposals (server also enforces).

**Document** · `app/print/service-proposals/[id]/page.tsx`
- Reuses the existing `CaPrintShell` letterhead (no second document system). Renders
  ONLY client-safe fields — internal notes, override reasons and internal figures are
  structurally never read here. Fee derivation shown only when `showFeeDerivation` is on.

**Nav** · added "Service Proposals" to Module 1's Design group (`modules.ts`) and the
Complete-AEC superset (`nav.ts`).

### Verification after Stages 6 & 7
| Check | Result |
| --- | --- |
| `npm test` | **117 passed** |
| `npx tsc --noEmit` | clean |
| `npx eslint` (new UI) | clean, 0 warnings |
| `npm run build` | compiles; all 5 routes present |
| `npm run golden` | passes — protected outputs unchanged |
| Runtime smoke | `/design/service-proposals` and `/new` return 200, no errors in the dev log |

### Release A status: COMPLETE and USABLE (not yet committed or deployed)
An architect can create a client/project proposal, choose percentage-of-construction-cost or
fixed fee, break the fee into phases, add a payment schedule, tax, discount and terms, preview
it live, save it, view the breakdown, issue it (immutable version snapshot), revise it without
losing history, and produce a client-facing document. Success criteria 1–11 met.

### Known limitations (Release A)
- Fee methods beyond percentage and fixed are declared but not implemented (Release B).
- Advanced wizard, scope-item library, optional-service catalogue, reimbursables editor and
  templates are Release B.
- Email delivery, tokenised client link + online acceptance, and approval thresholds are
  Release C (email also still blocked on a real `RESEND_API_KEY`).
- Conversion to project/invoice-schedule and analytics are Release D.
- With `AUTH_ENFORCE=false` locally and no login, the actor is VIEWER (read-only); creating a
  proposal requires a signed-in user. In production (auth on) users carry their real role.
- Live-DB integration tests remain the named gap from Stage 5 (no session-mock test harness).

### Next
Commit Release A (still uncommitted). Then Release B, or deploy Release A first — Greg's call.
