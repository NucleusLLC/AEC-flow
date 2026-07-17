# Protected Estimates Files — AEC-Flow Inventory

> Part of the [Protected Systems Policy](./protected-systems.md). Read-only
> forensic inventory of the **Estimates** (Cost Estimation / BOQ) system.
> Default disposition for every file below: **Keep Unchanged / Migration: No.**
> No file here may be modified without explicit written approval.

App stack: Next.js App Router, Prisma 7 (driver-adapter `@prisma/adapter-pg`),
Supabase/Postgres, TypeScript. Paths are repo-relative.

**Architecture note:** a strict **client/server Prisma boundary** splits each data
module into a client-safe `*.types.ts` / `-presets.ts` (types + seeds, no Prisma)
and a server-only `.ts` (`@/lib/db`). Costing is a **single source of truth** in
`lib/estimates/calc.ts` that drives screen, PDF, schedule, and the stored `amount`.

---

## 1. Routes

| Path | URL | Params | Keep? | Notes |
|---|---|---|---|---|
| `app/(app)/estimates/page.tsx` | `/estimates` (`?project=<id>`) | `project` | Yes | Entry. Server-loads projects, base estimate, price book, norm set, general conditions, templates, wiki, practice settings → `EstimatesApp`. `?project=` deep-links into a project's estimate. **Bookmarkable.** |
| `app/(app)/projects/[id]/estimates/page.tsx` | `/projects/<id>/estimates` | `id` | Yes | Per-project "Estimate" tab card; links to `/estimates?project=<id>`. `force-dynamic`. |
| `app/print/estimates/[id]/page.tsx` | `/print/estimates/<id>` (`?gc=1&usd=<rate>`) | `id`; `gc`,`usd` | Yes | Standalone printable A4 doc (`EstimateDocument`). `gc=1` = include General Conditions; `usd=<rate>` = USD secondary unit. **Bookmarkable/shareable PDF URL.** |

No `app/api/**` handlers — all server work via server actions.

## 2. UI Components (`components/estimates/`)

| File | Purpose |
|---|---|
| `estimates-app.tsx` | Top-level client orchestrator; project list vs `EstimateWorkspace`; `?project=` deep-link + "new estimate from project" seed. |
| `project-list-view.tsx` | Estimate list table (search, sortable columns, status badges) + "New estimate" picker. |
| `estimate-workspace.tsx` | **8-tab shell + toolbar.** Tabs: Estimate, Budget & Timeline, Take-Off, Rebar Calc, Norm Set, Price Lists, General Conditions/Overhead, Wiki. Owns lifted state + the single `budget` JSON payload, 2.5 s autosave (non-estimate tabs), version lock toggle, "New Version" dialog, Print/PDF trigger. |
| `estimate-view.tsx` (2154 ln) | **Main BOQ editor.** Editable sheet, meta header, roll-up summary, cost-per-m² strip, Print Control panel, cost charts, print-preview overlay (`EstimatePrintDoc`), autosave + local-draft backup + beforeunload guard, Assembly editor, Email-PDF. Preview == print (one renderer). |
| `estimate-document.tsx` | Presentational branded A4 "Cost Estimate / BOQ" sheet for the `/print/estimates/[id]` route → PDF. |
| `estimate-print-doc.tsx` (1426 ln) | Pass-2 renderer of the Smart Page-Break Engine; paginated doc: optional Cover Page, BOQ, Cost Summary, optional Time-Schedule Coupler + Payment Phase Configurator appendix. Defines `PrintControl`. |
| `budget-timeline-view.tsx` | Budget & Timeline tab: crew/hours/working-days, phase draws, retainage, contingency (from `lib/estimates/budget-timeline`). |
| `takeoff-view.tsx` | Quantity Take-Off sheet; measured rows → costed section. |
| `rebar-calculator-view.tsx` (628 ln) | Rebar Calculator tab (strip/column/beam/slab) over `lib/calc/rebar`. |
| `normset-view.tsx` | Norm Set editor → `saveNormSetAction`. |
| `price-list-view.tsx` | Materials & Equipment price book editor → `savePriceBookAction`. |
| `general-conditions-view.tsx` | General Conditions/Overhead editor → `saveGeneralConditionsAction`. |
| `wiki-view.tsx` | Estimating Wiki KB (search, edit, AI-fetch, image upload) → `saveWikiAction`. |
| `wiki-illustrations.tsx` | Built-in schematic SVGs for seeded wiki articles. |
| `cost-summary-charts.tsx` | Recharts donut + section bar chart; theme-aware. |
| `section-copy.tsx` | Copy/paste sections across estimates via `localStorage`; deep-reids on paste. |
| `print-button.tsx` | `window.print()` button on the print route. |

## 3. Server actions / entry points

- **`app/(app)/estimates/actions.ts`** (`"use server"`): `loadEstimateAction(id)`, `saveEstimateAction(estimate)` (recomputes stored `amount` via `estimateTotals().grandTotal`; revalidates `/estimates` + `/print/estimates/<id>`), `duplicateEstimateAction(id, version)`, `setEstimateLockAction(id, locked)`, `savePriceBookAction`, `saveNormSetAction`, `saveGeneralConditionsAction`, `saveTemplatesAction`, `saveWikiAction`.
- **`app/(app)/estimates/wiki-actions.ts`**: `aiFetchWikiArticle(topic)` — Claude (`claude-opus-4-8`) forced tool-use; uses `getAnthropicApiKey()`.
- **Server data entry points (`lib/data/`):** `estimates.ts`, `estimate-templates.ts`, `norm-set.ts`, `general-conditions-db.ts`, `estimating-wiki-db.ts`, `price-lists.ts`. No `app/api/**`.

## 4. Data-access & database

**Data-access (`lib/data/`):** `estimates.ts` (CRUD: `getEstimate`, `getEstimateById`, `getEstimateProjects`, `saveEstimate` (atomic upsert + wholesale replace categories/items in one txn), `duplicateEstimate`, `setEstimateLock`, `assertUnlocked`, `resolveClientId`), `estimates.types.ts` (`CostEstimate`, `EstimateCategory`, `EstimateItem`, `CalculationMethod` `norm|labor_rate|assembly`, `AssemblyComponent`, `EstimateBudget`, `TakeoffRow`, `USD_RATE_BY_CURRENCY`/`defaultUsdRate` AWG/ANG=1.79, `ESTIMATE_UNITS`), `estimate-presets.ts` (`NORM_SET`, `ESTIMATE_TEMPLATES`), `estimate-templates.ts`, `norm-set.ts`, `general-conditions.ts`/`-db.ts`, `estimating-wiki.ts`/`-db.ts`, `price-lists.ts`/`.types.ts`, plus `lib/estimates/seed-data.ts`.

**Prisma models (`prisma/schema.prisma`):**

| Model / enum (line) | Table | Key fields |
|---|---|---|
| `enum EstimateStatus` (1272) | — | DRAFT / IN_REVIEW / APPROVED |
| `CostEstimate` (1278) | `cost_estimates` | Header. Totals/version: `amount` (stored grand total), `avgLaborRate`, `profitPct`, `bboPct`, `gfa`, `version` (`V1.0`), `locked`, `status`, `currency`, `budget Json`. Relations: `categories`, `clientRef→Client` (nullable `clientId`), denormalised `projectId/projectNumber/projectName`. Tenant `companyId`. |
| `EstimateCategory` (1315) | `estimate_categories` | BOQ section: `name`, `code`, `sortOrder`; `items`; FK `estimateId` (cascade). |
| `EstimateItem` (1328) | `estimate_items` | BOQ line: `qty`, `unit`, `laborNorm`, `materialUnitCost`, `equipmentUnitCost`, `subcontractUnitCost`, `poc`, `code`, `sortOrder`, + engine fields `calculationMethod`, `laborRatePerUnit`, `assembly Json` (nullable → default Norm). FK `categoryId` (cascade). |
| `PriceItem` (1408) + `enum PriceKind` (1403) | `price_items` | Firm price book (MATERIAL/EQUIPMENT). |
| `NormSetTask` (1434) | `norm_set_tasks` | Firm standard-task library (fixed `laborNorm` + defaults). |
| `GeneralConditionItem` (1587) | `general_condition_items` | Firm preliminaries (qty × unitCost, `enabled`). |
| `EstimateTemplate` (1609) | `estimate_templates` | Whole-estimate templates; nested categories/items as `Json`; id = dotted handle. |
| `WikiArticle` (1627) | `wiki_articles` | Estimating KB; `facts Json`, `illoKey`, `image`. |

**Migrations:** none — `prisma db push`; seed via `prisma/seed.ts`. The estimate's own schedule/payment/takeoff live in the `budget` JSON, **not** the `ProjectSchedule`/`ScheduleTask` tables.

## 5. Calculation logic (most important — DO NOT ALTER)

**`lib/estimates/calc.ts` — single source of truth:**

| Function : line | Computes |
|---|---|
| `resolveLineLabor(it, rate)` : 52 | Method Resolver → `{hrs, labor}`. Norm: `hrs=qty×laborNorm`, `labor=hrs×rate`. Labor/Rate: `labor=qty×laborRatePerUnit` (hours from laborNorm, decoupled). |
| `calcAssembly(it)` : 71 | Assembly — sums typed components into 4 cost buckets; labor components add hours. |
| `calcItem(it, rate)` : 99 | Per-line dispatch. `mat=qty×materialUnitCost`, `equip=qty×equipmentUnitCost`, `sub=qty×subcontractUnitCost`; `total=labor+mat+equip+sub`; `prog=total×poc/100`. |
| `sum(a,b)` : 112 | Adds two `ItemCalc` roll-ups. |
| `pocPct(t)` : 124 | Overall % = `prog/total×100`. |
| `categoryTotals(c, rate)` : 126 | Section subtotal. |
| `estimateTotals(est, generalConditions?)` : 146 | **Whole-estimate roll-up:** `direct=Σ item totals`; `gcAmount` (opt-in); `markupBase=direct+gcAmount`; `profit=markupBase×profitPct/100`; `bbo=markupBase×bboPct/100`; `grandTotal=markupBase+profit+bbo`. |

The live editor `estimate-view.tsx` duplicates this roll-up inline (L574–638): `catTotals` (576), `direct`/`grand` (577), `gcAmount` (579), `markupBase` (580), `profit` (581), `bbo` (582), `grandTotal` (583), `grandPocPct` (584), `importedAmount` (589). **Cost per m²:** `area=est.gfa`, `perM2(n)=n/area` (631–633); also `estimate-document.tsx` L194–219.

**`lib/estimates/budget-timeline.ts`** (all via `calcItem`): `computeSections` (99), `computeGrandCost` (113), `computeDevelopmentCost` (126, `(direct+GC)×(1+profit%+bbo%)`), `computeSchedule` (150), `computeDraws` (213, retainage + imported 50/50), `addWorkingDays` (73).

**`lib/calc/rebar.ts`** — Rebar engine (kg/m³): `calcStripFoundation` (94), `calculateColumnRebarKgPerM3` (185), `calculateBeam` (260), `calculateSlabRebarKgPerM3` (382), + validators/helpers.

**`lib/estimates/pagination-engine.ts`** — Smart Page-Break Engine (pure): `simulateReportPages` (692), `paginateBlocks` (475), `splitOversizedBlock` (620), `validatePagination` (774), measurers (290–414).

Take-off math: `takeoff-view.tsx` `rawQty(r)` — area/volume/linear/count + waste %.

## 6. Version mechanism

A version is a **separate `CostEstimate` row** identified by the free-text `version` field (default `V1.0`; "EST-004 / Revision 4" = id + version label).
- **Lock/freeze:** `CostEstimate.locked` (schema 1302). `assertUnlocked(id)` (`lib/data/estimates.ts:198`) throws on every write if locked; `setEstimateLock` (205) is the only writer of `locked` — server-side gate (protects against stale-tab 2.5 s autosave). UI: lock toggle + amber banner (`estimate-workspace.tsx` 192–206, 280–376); client guard `setEstGuarded`.
- **New Version:** `duplicateEstimate(id, version)` (`estimates.ts:219`) deep-copies header+categories+items (fresh ids) + `budget`, DRAFT + unlocked. UI "New Version" dialog with `nextVersion()` minor bump (V1.0→V1.1).
- **Verification:** `scripts/verify-estimate-lock.ts`.

## 7. Reports & PDF/print

| File | Output |
|---|---|
| `app/print/estimates/[id]/page.tsx` | Route → browser print / Save-as-PDF (A4, `@page` 14 mm) → `EstimateDocument`. |
| `estimate-document.tsx` | Branded A4 BOQ sheet (letterhead, meta, BOQ table + subtotals, direct-cost composition, summary, cost-per-m², signature). |
| `estimate-print-doc.tsx` | Primary in-app print-preview + print doc. Pages: optional Cover, BOQ, Cost Summary, optional Time-Schedule Coupler, optional Payment Phase Configurator (PayApp). Preview == print. |
| `pagination-engine.ts` | Measurement-first pagination map (native print, no lib). |
| `cost-summary-charts.tsx` | Donut + bar in summary/cover. |
| `components/print/document-letterhead.tsx` | Shared letterhead. |
| `print-button.tsx` | Print trigger. |

**Print Control** toggles (`estimate-view.tsx:165–191`): column groups (labor/material/equipment/subcontractor/qtyUnit + rate columns), pageNum, zebra, rowSubtotal, logo, generalConditions page, timeline, phaseDisbursement, memo, chart, importedMaterials, methodDetail, collapsedSections.

## 8. Exports

No CSV/XLSX. PDF and email-PDF only:

| Trigger | Where | Format |
|---|---|---|
| "Print / PDF" toolbar | `estimate-workspace.tsx:355` | Opens `EstimatePrintDoc` preview |
| "Save as PDF" / "Print" | `estimate-view.tsx:1856/1859` (`window.print()`) | Browser PDF |
| **"Email PDF"** | `estimate-view.tsx:1864` & `:769` — `EmailButton` | Composes email (subject `Estimate — <project> (<version>)`, attachment `<project> — Estimate <version>.pdf`, prefilled to client). Compose live; PDF via browser Save-as-PDF. |
| Print route "Print / Save as PDF" | `print-button.tsx` | Browser PDF |

## 9. Tests

| File | Asserts |
|---|---|
| `lib/calc/rebar.test.ts` | Rebar formulas (`node:test`): Strip Type 1 ≈ 41.37 kg/m³, Type 2, Column, Beam, Slab. Run: `npx tsx --test lib/calc/rebar.test.ts`. |
| `scripts/verify-calc.ts` | Method-Resolver invariants: Norm byte-identical to pre-engine formula; Labor/Rate decouples cost from hours. `npm run verify:calc`. |
| `scripts/verify-estimate-lock.ts` | Version lock is a server rule. |
| `scripts/verify-persistence.ts` | Round-trips Labor/Rate + Assembly through save→read→delete. |
| `scripts/verify-pagination.ts` | Page-break engine correctness. |
| `scripts/backfill-estimate-clients.ts` | One-shot legacy client-link backfill (maintenance). |

## 10. Permissions / access

- **Auth:** under `app/(app)/` session auth. No estimate-specific role checks.
- **Tenant scoping:** `lib/db.ts` `$extends` injects `companyId` for `TENANT_MODELS` incl. `CostEstimate`, `PriceItem`, `NormSetTask`, `GeneralConditionItem`, `EstimateTemplate`, `WikiArticle`. `findUnique*` guards row by companyId; `update`/`delete`/`upsert` add companyId to the unique where. `currentCompanyId()` = `undefined` in scripts/seeds → unscoped there. Sole cross-tenant boundary.
- No per-user RBAC beyond company isolation.

## 11. Integrations (references from other systems)

| Referencing file | Nature |
|---|---|
| `lib/nav.ts:57` | Sidebar "Estimates" → `/estimates`. |
| `components/projects/project-tab-bar.tsx:29` | Project "Estimates" tab → `<base>/estimates`. |
| `components/projects/dashboard/widgets.tsx:415` | Project dashboard quick-link. |
| `components/projects/section-panel.tsx` | Lists Estimates as a project section. |
| `app/(app)/clients/[id]/page.tsx:209–227` | Client page lists client's estimates → `/estimates?project=<id>` (via `clientId` FK). |
| `lib/data/clients.ts:174,218,257` | Client query includes `estimates`; `ClientEstimate` DTOs; folds `updatedAt` into activity. |
| `lib/data/estimates.ts:164–183` | `resolveClientId` heals estimate→client link. |
| `app/(app)/projects/[id]/estimates/page.tsx` | Project→estimate entry point. |
| `prisma/seed.ts`, `lib/estimates/seed-data.ts`, `core-seed-data.ts`, `company-seed.ts` | Seed estimates (e.g. `ZA-2026-014`). |

The estimate's own schedule/payment/takeoff live in the `budget` JSON — decoupled from the `ProjectSchedule`/`ScheduleTask` (Gantt) tables.

## 12. Terminology & settings

**Domain terms (preserve verbatim):** BOQ / Bill of Quantities, Section (= EstimateCategory), Line item/task; Norm / Labor Norm, Norm Set, Norm Hrs/Unit; Calculation Method: Norm-Based (default), **Labor/Rate**, **Assembly-Based**; Direct Cost, Markup base, **Profit & Risk** (`profitPct`), **BBO** (overhead, `bboPct`), Grand Total, General Conditions/Overhead (opt-in), **Imported Materials, Equipment & Logistics** (equipment carve-out), **POC** (percent of completion), Cost per m², Built-up Area / GFA; Total Development Cost, Time-Schedule Coupler, Payment Phase Configurator (PayApp), Draw/Retainage/Retention, Contingency; Version/Lock/New Version, Take-Off, Rebar Calculator, Wiki, Price List/Price Book, Cover Page, Print Control, Memo/Remark.

**Settings/config:** Currency per estimate (default USD) + USD secondary unit w/ FX; `USD_RATE_BY_CURRENCY` pegs AWG/ANG at 1.79, EUR 1.08 (`estimates.types.ts:144`) — Aruba/Caribbean context. Units `[m³,y³,m²,m,lm,bf,no,kg,ton,ls,set,day]`. Rates: `avgLaborRate`/hr, `profitPct` (24), `bboPct` (7) defaults in `EMPTY_ESTIMATE` (`estimates.ts:94`). `DEFAULT_ESTIMATE_ID = "EST-2026-014"`. Print control + logo scale + letterhead/footer from `getPracticeSettings()`. `budget` JSON sub-config (`EstimateBudget`): schedule, payment, takeoff, fx{usd,rate}, gcActive, rebar, cover — replaced wholesale on save. AI wiki = `claude-opus-4-8`. Data-loss safeguards: atomic transactional save, 2.5 s debounced autosave + localStorage draft + beforeunload guard, server-side lock.

---

## Complete file list to protect

```
Routes:
  app/(app)/estimates/page.tsx
  app/(app)/estimates/actions.ts
  app/(app)/estimates/wiki-actions.ts
  app/(app)/projects/[id]/estimates/page.tsx
  app/print/estimates/[id]/page.tsx
Components (all of components/estimates/):
  estimates-app.tsx, project-list-view.tsx, estimate-workspace.tsx,
  estimate-view.tsx, estimate-document.tsx, estimate-print-doc.tsx,
  budget-timeline-view.tsx, takeoff-view.tsx, rebar-calculator-view.tsx,
  normset-view.tsx, price-list-view.tsx, general-conditions-view.tsx,
  wiki-view.tsx, wiki-illustrations.tsx, cost-summary-charts.tsx,
  section-copy.tsx, print-button.tsx
Logic libs:
  lib/estimates/{calc.ts,budget-timeline.ts,pagination-engine.ts,seed-data.ts}
  lib/calc/rebar.ts
Data layer:
  lib/data/{estimates.ts,estimates.types.ts,estimate-presets.ts,
            estimate-templates.ts,norm-set.ts,general-conditions.ts,
            general-conditions-db.ts,estimating-wiki.ts,estimating-wiki-db.ts,
            price-lists.ts,price-lists.types.ts}
Infra:
  lib/db.ts   (tenant scoping)
  prisma/schema.prisma   (CostEstimate, EstimateCategory, EstimateItem, PriceItem,
                          NormSetTask, GeneralConditionItem, EstimateTemplate, WikiArticle)
  prisma/seed.ts
Tests/scripts:
  lib/calc/rebar.test.ts
  scripts/{verify-calc.ts,verify-estimate-lock.ts,verify-persistence.ts,
           verify-pagination.ts,backfill-estimate-clients.ts}
Shared support:
  components/print/document-letterhead.tsx
  components/email/email-button.tsx
```
