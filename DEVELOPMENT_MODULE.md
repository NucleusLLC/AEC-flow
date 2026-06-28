# Land Development / Parceling Plan Module

A turnkey development-management module: take a raw parcel through acquisition,
parceling layout, infrastructure budget, lot & unit sales, permits, cash flow and
profit — A to Z. Modelled on the Coriara / Morgenster pro-forma worksheets.

## Status

**Phase 1 + 2 + all 11 workspace tabs — delivered & verified.**

| Layer | Files | State |
| --- | --- | --- |
| Calculation engine | `lib/development/calc.ts` | ✅ pure, client-safe, **17 unit tests pass** (`calc.test.ts`) |
| Types / enums / labels | `lib/data/development.types.ts` | ✅ 20 entities, client-safe |
| Derived metrics | `lib/development/metrics.ts` | ✅ dashboard/list roll-ups |
| Demo seed | `lib/development/seed-data.ts` | ✅ Morgenster (ties out exactly) |
| Prisma schema | `prisma/schema.prisma` | ✅ 12 models + enums (+ seed in `prisma/seed.ts`) |
| Data layer | `lib/data/development.ts` | ✅ Prisma-first reads (seed fallback) **+ write functions** |
| Write API | `app/api/development/[id]/**` | ✅ PATCH project · PUT land / lots / budget / cash-flow / permits / units |
| UI — workspace | `app/(app)/development/**` | ✅ List → Dashboard, Setup, Land, Lots, Units, Costs, Permits, Sales, Cash Flow, Scenarios, Reports |

**Persistence:** every editable tab (Setup, Land, Lots, Costs, Cash Flow, Permits,
Units) has a Save control that sends the full state to the API and persists via
Prisma (verified round-trip against the live DB). Writes return **503** if the DB
is unreachable — they never silently no-op. Bulk-save semantics = full replace per
project; Setup is a PATCH.

**Tabs:** Dashboard (KPIs + charts) · Setup · Land (live land-use + acquisition) ·
Lots (editable inventory) · Units (per-component cost) · Costs (cost-code budget,
budget/committed/paid/variance) · Permits (entitlement tracker + overdue flags) ·
Sales (CRM pipeline + absorption) · Cash Flow (monthly planner + peak-capital +
cash curve) · Scenarios (base/conservative/optimistic + live custom + sensitivity)
· Reports (feasibility summary + live CSV export + print/PDF).

**Documents tab** (`/development/[id]/documents`) — manage project documents
(deeds, surveys, plans, approvals, contracts, receipts) via the `DevDocument`
entity; add/remove + Save (`PUT …/documents`), external links open in a new tab.

**Branded A4 PDF reports** — `app/print/development/[id]/{feasibility,lots,investor,closeout}`
render a ZenArch letterhead sheet (`components/development/print-shell.tsx`,
`@page { size: A4 }`) → browser "Save as PDF". Linked from the Reports tab
alongside the CSV exports.

**Project lifecycle** — Duplicate (deep-copy) + Archive/Unarchive in the
workspace header (`components/development/project-actions.tsx`).

**CSV import** — Lots and Budget tabs have an "Import CSV" control
(`components/development/csv-import.tsx` + `lib/development/csv.ts`, a dep-free
parser handling quoted fields). Imported rows append to the table, then Save
persists. Lots columns: `lotNumber,area,basePrice,premium,phase,status`; budget
columns: `code,category,item,qty,unit,rate,committed,paid`.

**Commercial entities** — procurement chain (**Vendor → Contract → Invoice →
Payment**) on a new **Procurement** tab (`procurement-view.tsx`, fully editable
with per-section Save + contracted/invoiced/paid/retention roll-up), and editable
**BuyerReservation / SalesContract** sections on the Sales tab. 6 Prisma models
(`dev_vendors`, `dev_contracts`, `dev_invoices`, `dev_payments`,
`dev_buyer_reservations`, `dev_sales_contracts`), seeded, deep-copied by Duplicate,
with `save*` data-layer functions + `PUT` API routes
(`app/api/development/[id]/{vendors,contracts,invoices,payments,reservations,sales-contracts}`).
Write round-trip verified against the live DB.

**Remaining (next phases):** file upload to storage (documents currently store a
link); per-line vendor/contract linkage on budget items.

> **Op note:** after changing `schema.prisma` you must `npx prisma db push`
> (create tables) AND **force-restart `next dev`** so the running server loads the
> regenerated Prisma client — otherwise reads silently fall back to seed and
> writes 500 with `prisma.<model> undefined`.

## Workflow (A → Z)

1. **Setup** — project identity, parties, classification (ROPV / zoning), programme dates.
2. **Land** — allocate the gross parcel into non-sellable (road, green, drainage…) vs **net sellable**; enter acquisition costs → cost per gross / net m². Live warnings (low sellable ratio, green shortfall, high road %).
3. **Lots** — Excel-style editable inventory; each lot's allocated cost = area × project cost/net-m²; live profit, margin, weighted-average roll-up.
4. **Units** — per-component construction & sales cost for homes/apartments; profit per unit × quantity.
5. **Dashboard** — KPI tiles + charts (revenue vs cost, sales status, cost by code, profit by lot) + sales/budget/permit progress.

## Formulas (see `lib/development/calc.ts`)

```
netSellableLand        = grossParcelArea − (road + sidewalk + green + utility + drainage + common + pool/deck + retained + other)
costPerGrossM2         = totalAcquisitionCost / grossParcelArea
costPerNetSellableM2   = totalProjectCost / netSellableLand           (= break-even sales price/m²)
lotSalesPrice          = area × (baseLandPrice + premium)
lotAllocatedCost       = area × costPerNetSellableM2                  (or explicit land+infra+soft)
lotProfit              = lotSalesPrice − lotAllocatedCost
unitConstructionCost   = Σ componentArea × constructionCostPerM2
unitSalesPrice         = Σ componentArea × salesPricePerM2
combinedProfit         = (lotSales + unitSales) − (lotCost + unitCost)
roi                    = netProfit / totalProjectCost
grossMargin            = netProfit / totalRevenue
```

## Reference reconciliation (Morgenster 2023A-038)

The engine and seed reproduce the worksheet **exactly** (asserted in `calc.test.ts`):

| Metric | Value |
| --- | --- |
| Net sellable land | 4,404 m² |
| Total project cost | AWG 1,601,373.60 |
| Cost / net sellable m² | AWG 363.62 |
| Sales price / m² | AWG 450 → profit/m² AWG 86.38 |
| Profit on parcels | AWG 380,426.40 |
| Profit per home (× 13) | AWG 78,867 → 1,025,271 |
| **Total project profit** | **AWG 1,405,697.40** |

## Notes

- **Money** is Prisma `Decimal`; **areas / rates / percentages** are `Float`.
- The calc engine has **no DB import**, so tables recompute instantly client-side.
- Going live: unpause Supabase → `npx prisma db push` → `npm run db:seed` (the
  Morgenster demo is seeded alongside the Construction-Admin data). Until then the
  data layer serves the seed fallback automatically.
- Tests: `npx tsx --test lib/development/calc.test.ts`.
