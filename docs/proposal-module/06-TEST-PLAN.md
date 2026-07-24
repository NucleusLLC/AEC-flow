# Proposal Module — Test Plan (Phase 2)

**Precondition:** the repository has no test framework. `04-IMPLEMENTATION-PLAN.md` Stage 0.3
adds **Vitest** scoped to `lib/**`. Without it, none of the below is executable and the
module cannot honestly be called complete.

Existing regression scripts (`npm run golden`, `npm run verify:calc`) must keep passing
unchanged throughout — they are the proof that the protected Estimates and Schedule systems
were not disturbed.

---

## 1. Unit tests — fee engine (`lib/proposals/engine/**`)

The engine is pure and deterministic, so this layer carries the heaviest coverage.

### 1.1 Money and allocation

| Case | Expectation |
| --- | --- |
| `allocate(100.00, [10,15,35,40])` | `[10.00, 15.00, 35.00, 40.00]`, sums exactly |
| `allocate(1000.00, [1/3,1/3,1/3])` | sums exactly to 1000.00; remainder lands deterministically |
| `allocate(0.05, [50,50])` | `[0.03, 0.02]` — no lost cent |
| Property test, 10k random totals × weights | `sum(parts) === total` **always** |
| Rate application | half-up rounding at minor unit |
| Negative inputs | clamped or rejected, never silently negative |

### 1.2 Percentage fees

| Case | Expectation |
| --- | --- |
| 2,500,000 × 7.50% | 187,500.00 (the spec's worked example) |
| Basis = estimate `direct` vs `grandTotal` | different results, each labelled; never auto-picked |
| Percentage with no basis | **blocking error** |
| Basis changed after calculation | `COST_BASIS_DRIFT` warning with previous/new basis, previous/new fee, delta, % change. **No auto-recalculation** |

### 1.3 Development-cost basis and the circular guard

| Case | Expectation |
| --- | --- |
| Worksheet with `includedInBasis` flags | basis = sum of included categories only |
| "Professional fees" category included + percentage fee | circularity **detected** |
| Default resolution | own fee excluded from own basis; warning names the method |
| Gross-up alternative, r < 1 | `fee = (base × r) / (1 − r)` |
| `r >= 1` | blocking error, not `Infinity`/`NaN` |

### 1.4 Fixed fees and reconciliation

| Case | Expectation |
| --- | --- |
| 150,000 split 15/20/35/10/20 | 22,500 / 30,000 / 52,500 / 15,000 / 30,000, sums exactly |
| Allocation ≠ 100% | **warning**, not a blocking error |
| Discipline allocations ≠ total | warning naming the shortfall |

### 1.5 Multi-discipline and hybrid

The spec's example as a fixture: Architecture 6% of 3,000,000 = 180,000; Interior fixed
55,000; Structural 1.25% = 37,500; MEP 1.75% = 52,500 → base 325,000. Plus optional
renderings 12,000 and reimbursable allowance 5,000 → subtotal 342,000; discount 10,000 →
332,000; tax per configuration; grand total = adjusted subtotal + tax.

Asserted: **optional services excluded from base**, discount preserves the original amount,
and the printed breakdown reconciles.

### 1.6 Optional services, discounts, tax

| Case | Expectation |
| --- | --- |
| Optional service unselected | absent from `grandTotal`, present in `optionalServicesTotal` |
| Optional service selected | moves into the total; audit trail records the change |
| Discount applied | original fee retained; `Original → Less discount → Adjusted` all available |
| Tax exclusive | tax on taxable subtotal **after** discount |
| Tax inclusive | back-computed correctly; total unchanged by mode flip at equal effective price |
| Non-taxable line | excluded from the taxable subtotal |
| Zero-rate / no tax configured | totals valid, no `NaN` |

### 1.7 Overrides and status

| Case | Expectation |
| --- | --- |
| Override set | `calculatedAmount` **preserved**; total uses override; delta reported |
| Override without reason | blocked |
| Legal transition (`Draft → Internal Review`) | allowed |
| Illegal transition (`Draft → Accepted`) | rejected |
| Any transition | writes `ProposalStatusHistory` |

---

## 2. Integration tests (service layer + DB)

Run against a dedicated test company so tenant behaviour is real.

| Area | Assertions |
| --- | --- |
| **Tenant isolation** | Company B cannot read, update or delete Company A's proposal (P2025 / null). **Every new model asserted present in `TENANT_MODELS`** — the list and the schema must agree |
| Create / draft / autosave | Round-trips; partial data allowed on a draft |
| Transaction integrity | A failure mid-write leaves **no** partial proposal |
| Totals authority | Client-supplied totals are ignored; server recomputes from the engine |
| Version immutability | Issuing snapshots the proposal; editing an issued version is rejected; the snapshot is unchanged after later header edits |
| Locking | Accepted proposal rejects scope/fee/term edits at the **data layer** |
| Permissions | `STAFF` may create/edit (A3); `approve`/`convert`/`configure` rejected below threshold — enforced server-side, not just hidden in UI |
| Numbering | Sequential per company; never reuses a voided or deleted number; two companies may both hold `PROP-2026-001` |
| Audit | Every mutation writes `ActivityLog` |
| Backward compatibility | Existing `kind = SIMPLE` proposals load and render through the existing BD pages unchanged |

---

## 3. Document tests

| Case | Expectation |
| --- | --- |
| **Confidentiality** | Client-facing render contains **no** margin, internal cost budget, internal notes or override reason. Asserted by rendering a proposal seeded with sentinel values and searching the output |
| Version fidelity | Document renders from the snapshot; editing the live proposal afterwards does not alter the issued document |
| Required fields present | proposal number, version, issue date, expiry, currency, tax, totals, acceptance block |
| Section config | Hidden sections absent; reordering respected |
| Totals reconciliation | Printed fee breakdown sums to the printed grand total |

---

## 4. End-to-end — deferred, and why

No Playwright/Cypress in the stack; adding one requires a seeded test DB, auth bypass and CI
that do not exist. **E2E is explicitly out of scope for Release A** rather than claimed.

The ten E2E scenarios the spec lists are covered as follows in the interim:

| Spec scenario | Interim coverage |
| --- | --- |
| 1. Quick fixed-fee architectural | Integration + manual checklist |
| 2. Percentage-based architectural | Unit (1.2) + integration |
| 3. Interior fixed-fee | Unit (1.4) |
| 4. Multidiscipline | Unit (1.5) |
| 5. Hybrid fee | Unit (1.5) — Release B |
| 6. Optional services | Unit (1.6) |
| 7. Discount | Unit (1.6) |
| 8. Tax-inclusive | Unit (1.6) |
| 9. Revision after feedback | Integration (§2, version immutability) — Release C |
| 10. Accepted → project | Integration — Release D |

---

## 5. Manual testing checklist (Release A)

1. Create a client and a project; start a Quick Proposal.
2. Choose percentage basis; pull the cost basis from an existing estimate; confirm the basis
   name and amount are shown beside the percentage.
3. Enter 7.5%; confirm the fee matches a hand calculation.
4. Switch to fixed fee; confirm the implied percentage is displayed.
5. Confirm the default phase split (10/15/35/40) and that amounts sum exactly to the fee.
6. Change a phase percentage so the total is 97%; confirm a **warning**, not a hard block.
7. Add a payment schedule that does not reconcile; confirm a warning naming the difference.
8. Save a draft, leave, return — confirm everything persisted.
9. Preview the document; confirm no internal figures appear.
10. Print to PDF; confirm no broken tables, orphan headings or lost footers.
11. Issue the proposal; confirm status history and that the document is now snapshot-backed.
12. Edit the issued proposal; confirm it is refused, with a clear message.
13. Log in as a second company; confirm the proposal is invisible.
14. Confirm `/proposals` (existing Business Development list) is visually unchanged.
15. Run `npm run golden` — must pass unchanged.
