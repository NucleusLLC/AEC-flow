# Protected Systems Policy

> **Status:** Active. This policy governs the modular reorganization of AEC-Flow
> (Modules 1–4). It revises and takes priority over any prior instruction that
> suggests reorganizing, refactoring, rebuilding, renaming, consolidating,
> redesigning, migrating, or otherwise modifying the **Estimates** or **Schedule**
> systems.

## Purpose

AEC-Flow already contains two highly developed, production-critical systems that
have been built, reviewed, and refined over an extended period:

1. **Estimates**
2. **Schedule**

These systems are **protected**. They are being *installed as-is* into a new
modular application shell (Module 3 — Construction Estimates & Construction
Timeframe; Module 4 — Complete AEC). They are **not** features awaiting redesign.

The working model is:

```
Protect → Audit → Wrap → Connect → Verify
```

Never:

```
Inspect → Redesign → Refactor → Replace
```

## Protected system declaration

```ts
type ProtectedSystem =
  | "estimates"
  | "schedule";

interface ProtectedSystemPolicy {
  key: ProtectedSystem;
  displayName: string;
  protected: true;
  modificationPolicy: "integration_only";
  requiresExplicitApprovalForInternalChanges: true;
}

export const protectedSystems: Record<ProtectedSystem, ProtectedSystemPolicy> = {
  estimates: {
    key: "estimates",
    displayName: "Estimates",
    protected: true,
    modificationPolicy: "integration_only",
    requiresExplicitApprovalForInternalChanges: true,
  },

  schedule: {
    key: "schedule",
    displayName: "Schedule",
    protected: true,
    modificationPolicy: "integration_only",
    requiresExplicitApprovalForInternalChanges: true,
  },
};
```

## The rule

> **Estimates and Schedule may be connected to module navigation, access control,
> project context, version identification, and shared document services, but their
> internal implementation may not be changed without explicit written
> authorization.**

## "Integrate as-is" — what that means

The modular reorganization may place an **external shell** around the existing
systems, but must not alter their internal behavior.

### Permitted (integration only — outside the protected code)

- Add navigation links to Estimates and Schedule.
- Display the active module in the application shell / lower-left identity panel.
- Apply a module-access guard before entering the systems.
- Pass existing project ID, organization, and user context into the systems.
- Add breadcrumbs and return navigation **outside** the protected system.
- Register existing reports with the shared Document Generator.
- Link existing Estimate / Schedule records to generated documents.
- Add non-invasive telemetry or error logging.
- Add compatibility **adapters** outside the protected code.
- Add tests that verify existing behavior remains unchanged.

### Not permitted (without explicit written approval)

- Changing any calculation: material, labor, equipment, productivity, Norm vs
  Labor Rate, overhead, profit, tax, contingency, direct cost, or grand total.
- Changing estimate version logic, tables, forms, or workflows.
- Changing scheduling algorithms, activity/dependency logic, duration or
  critical-path calculations, predecessor/successor behavior, Gantt behavior,
  schedule views, forms, timeline, or scheduling reports.
- Renaming internal fields without necessity.
- Migrating data merely to match a new preferred architecture.
- Replacing existing components or libraries because newer ones exist.
- Combining Estimates and Schedule into a new third system.
- Removing features that appear duplicated.
- Restyling either system to match a new visual concept.
- Rewriting under a new state-management approach or folder structure.
- Altering existing responsive behavior except to correct a verified defect
  **with explicit approval**.

## One system each — no duplicates

There must be exactly **one** Estimate system and **one** Schedule system. Both
Module 3 and Module 4 expose the *same* systems and records, gated by module
capabilities and permissions. Separate per-module Estimate/Schedule databases are
**prohibited**.

## Version domains are distinct

Do not confuse the module version with protected-system record versions:

```
Module 3 Version:        Beta V0.015
Estimate Record Version: EST-004 / Revision 4
Schedule Record Version: SCH-003 / Revision 3
```

The module version lives in the application shell / lower-left identity panel.
Inside Estimates and Schedule, the existing record-version mechanisms are
preserved unchanged.

## Change-control procedure

If a defect in a protected system directly blocks module integration:

1. Document the issue.
2. Identify the minimum required change.
3. Isolate the change.
4. Explain the potential impact.
5. **Do not proceed** without explicit approval when the change affects internal
   behavior.

No opportunistic refactoring. No unrelated cleanup while integrating.

## Protected file & database inventories

The authoritative file/route/table inventories live in:

- [`protected-estimates-files.md`](./protected-estimates-files.md)
- [`protected-schedule-files.md`](./protected-schedule-files.md)

Any pull request touching paths listed as protected in those inventories must be
flagged for explicit protected-system approval.
