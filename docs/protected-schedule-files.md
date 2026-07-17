# Protected Schedule Files — AEC-Flow Inventory

> Part of the [Protected Systems Policy](./protected-systems.md). Read-only
> forensic inventory of the **Schedule** (project programme / Gantt) system.
> Default disposition for every file below: **Keep Unchanged / Migration: No.**
> No file here may be modified without explicit written approval.

App stack: Next.js App Router (`app/(app)/...`), Prisma 7, Supabase/Postgres,
TypeScript. Paths are repo-relative.

**Scope note:** Schedule is a self-contained, compact module — 2 route files, 4
components, 1 server action, 2 data-access files, 2 Prisma models, 1 verification
script. It is entirely distinct from the construction-admin "schedule *impact*"
(delay) fields, which are a different concept (see §11).

---

## 1. Routes

| Path | URL | Params | Keep? | Notes |
|---|---|---|---|---|
| `app/(app)/schedule/page.tsx` | `/schedule` | — | Yes | Main page (server component). Loads all schedules + project directory, renders `ScheduleApp`. Project selection is client state, **not** in the URL → individual programmes are not deep-linkable here. |
| `app/print/schedule/[id]/page.tsx` | `/print/schedule/{projectId}` | `id` = projectId (e.g. `ZA-2026-014`) | Yes | Print/PDF preview. `getSchedule(id)` + letterhead logo → `SchedulePrint`. **The only per-schedule deep link.** `notFound()` if missing. |

No schedule entry point nested under `app/(app)/projects/**`. Only nav entry is top-level `/schedule`.

## 2. UI Components

| Path | Purpose |
|---|---|
| `components/schedule/schedule-app.tsx` | Client shell: project picker + "New Schedule" dropdown, crumb, `EmailButton`, renders `ScheduleGantt`. |
| `components/schedule/schedule-gantt.tsx` | **Core interactive Gantt (~1526 lines).** `ScheduleGantt` + `GanttBoard`: timeline bands (day/week/month/year), zoom, drag move/resize, dependency linking, task/sub-task CRUD, reorder, categories/sub-categories editor, working-calendar panel, critical-path toggle, budget "coming soon" panel, status board, save, selection detail editor. |
| `components/schedule/status-board.tsx` | Schedule-health strip: on-track/watch/at-risk, metric tiles (Actual/Planned %, SPI, variance days, behind/overdue, baseline & forecast finish), critical-path callout, attention list; `statusDate` control. |
| `components/schedule/schedule-print.tsx` | Print/PDF renderer (A4/A3/A2/A1, landscape/portrait, zoom/fit): static Gantt sheet, title block, month bands, dependency arrows, discipline-coloured bars, legend, page-break guides, `@page` CSS. |

**Shared deps (not schedule-owned, preserve):** `components/projects/project-picker.tsx` (`ProjectPicker`/`ProjectCrumb`/`ProjectPickerRow`), `components/email/email-button.tsx` (**placeholder send — logs to console**), `components/ui/card.tsx`, `components/print/document-letterhead.tsx`.

## 3. Server actions / API

| Path | Purpose |
|---|---|
| `app/(app)/schedule/actions.ts` | Single action `saveScheduleAction(input)` → validates `projectId`, `saveSchedule`, `revalidatePath("/schedule")` + `/print/schedule/{projectId}`. Returns `{ok,id}` / `{ok:false,error}`. |

No `app/api/**` handlers for schedule. Print route uses `getPracticeSettings()` (`lib/server/practice-config.ts`).

## 4. Data-access & database

| Path | Purpose |
|---|---|
| `lib/data/schedule.ts` | **Prisma-free** (client-safe). Types (`ScheduleTask`, `ProjectSchedule`, `ScheduleBoardConfig`, `Discipline`, `ScheduleStatus`), `SEED_SCHEDULES`, `DISCIPLINE_LABEL`, `HOURS_PER_DAY = 8`, date utils, and pure algorithms `computeCpm` + `computeScheduleHealth`. |
| `lib/data/schedule-db.ts` | **Server-only** (Prisma). `getSchedule(projectId)`, `getSchedules()` (both "DB row if present, else seed"), `saveSchedule(input)` (upsert + wholesale task replace in a `$transaction`), `rowToSchedule`. `SaveScheduleInput` lives here. |

**Prisma models (`prisma/schema.prisma`):**
- **`ProjectSchedule`** (`project_schedules`, ~L1359–1373): `id` cuid PK, `projectId` **@unique**, `projectNumber`, `projectName`, `client?`, `manager?`, `config Json?` (board settings), `companyId String?` (tenant), timestamps; `tasks ScheduleTask[]`.
- **`ScheduleTask`** (`schedule_tasks`, ~L1375–1396): `id` PK, `scheduleId` FK, `taskKey` (stable client id e.g. `t1`), `name`, `discipline`, `status`, **`start`/`end` as ISO strings** (TZ-safe), `progressPct Float`, **`dependsOn String[]`** (task keys, finish-to-start), `assignee?`, **`parentId?`** (sub-tasks), `durationUnit?`, `category?`, `subCategory?`, `sortOrder`. `onDelete: Cascade`, `@@index([scheduleId])`.

**Related but NOT wired to the Gantt** (documented as intended future source): `ProjectPhase` (~L393–415), `PhaseDependency` (~L417–425, has `type` FS/etc. + `lagDays` — unused by Gantt), `PhaseAssignment` (~L427–436).

**Migrations:** none — schema applied via `prisma db push`; no `prisma/migrations/**`.

## 5. Scheduling algorithm & calculation logic

All computation is in `lib/data/schedule.ts` (pure) + `schedule-gantt.tsx` (positioning). **Durations derive from each task's own `start`/`end`.**

- Date/duration utils: `toScheduleDate` (L147), `addDaysIso` (L149), `diffDaysIso` (L154), `durationDays` = `diff+1` **inclusive** (L157), `HOURS_PER_DAY=8` (L36).
- **`computeCpm(tasks)`** (L170–229): forward pass `calcEF` (L182, cycle-safe), `projectDays` = max EF (L197), successor map (L199), backward pass `calcLS` (L205, cycle-safe), slack = LS−ES, **slack ≤ 0 ⇒ critical** (L220–226). Returns `{critical:Set, slack, projectDays}`. Uses **dependency-relative** offsets, independent of the calendar `start` dates the user sets.
- **`computeScheduleHealth(tasks, statusDate, critical)`** (L274–379): per-task expected % at data date (L296), duration-weighted earned/planned (L301), state classification ±5% (L309), aggregates `pctActual`/`pctPlanned` (L340), **`spi = earned/planned`** (L342), `varianceDays` (L343), `baselineFinish` (L344), `criticalSlipDays` (L335), `forecastFinish` (L348), `overall` (L350), `attention` list (L353).
- Overall progress = mean of `progressPct` (`schedule-gantt.tsx` L651).
- Positioning: `pxPerDay` (L288), display order (L291), header bands (L327–405), weekend/holiday shading (L408–426), dependency arrows (L1226–1250), bars with progress + behind-plan hatch (L1254–1328).

**No milestones** (no zero-duration type; every task is a duration bar).

**⚠️ Caveat — no forward-scheduling engine:** `computeCpm` gives genuine critical-path/slack analysis over finish-to-start deps, but the system does **not** auto-move task dates from predecessors. Dates are set manually (typed/dragged/resized). Creating a link does not reschedule the successor; `lagDays` / dependency `type` from `PhaseDependency` are **not** honored. Real CPM analysis exists; constraint-based auto-scheduling does not.

## 6. Version mechanism

**None.** No revision/version concept (no `SCH-003 / Revision 3`, no version number, no history/snapshot table). A schedule is identified solely by `projectId` (`@unique`); **saves replace the task list wholesale** (`saveSchedule` deletes all `ScheduleTask` rows and recreates them in a transaction — `schedule-db.ts` L109–124). "Baseline finish" in the status board is the current latest end date, not a stored baseline.

## 7. Reports & PDF/print

| Path | Output |
|---|---|
| `app/print/schedule/[id]/page.tsx` + `components/schedule/schedule-print.tsx` | The only report: a printable **Gantt programme sheet** ("Project Programme — Gantt"), sized A4/A3/A2/A1 × landscape/portrait, → PDF via browser print. Letterhead, month bands, dependency arrows, discipline-coloured bars with %, critical highlight, legend, page-break guides. |

No separate activity-list / milestone / look-ahead / status report as distinct outputs; status board is on-screen only.

## 8. Exports

- **PDF:** print route only — browser "Save as PDF" via `window.print()` (`schedule-print.tsx` L221–236).
- **Email:** `EmailButton` (`schedule-app.tsx` L87) offers `"{project} — Schedule.pdf"`, but send is a **placeholder** (`email-button.tsx` L77–82, console log only).
- **CSV / XLSX:** none.

## 9. Tests

- `scripts/verify-schedule-persistence.ts` — standalone round-trip verification (run manually, not a test-runner test). Asserts unknown project → null; read-back after save; task count; task keys; `dependsOn`; category; progress; window; and wholesale replace on re-save. Cleans up `ZZZ-SCHED-TEST`.
- No `*.test.ts` / `*.spec.ts` for schedule. CPM/health algorithms have no unit coverage.

## 10. Permissions / access

- **Tenant scoping** via the Prisma extension in `lib/db.ts`: `ProjectSchedule` **is** in `TENANT_MODELS` (L22) → auto `companyId` injection on reads/writes, post-filter on `findUnique` (L80–86). `ScheduleTask` is **not** in `TENANT_MODELS` (no `companyId`) — protected transitively via its parent. `ProjectSchedule.companyId` nullable; `create` auto-sets from request context (L87–94).
- **Auth:** under the authenticated `app/(app)/...` group (layout-level auth, not re-checked in the page).
- **Roles:** none — no read-only vs edit gating; any user reaching `/schedule` can edit and save.
- **Seed caveat:** `SEED_SCHEDULES` demo programmes are returned for any project without a persisted row **regardless of tenant** (hard-coded, not company-scoped).

## 11. Integrations

| Referencing file | Nature |
|---|---|
| `lib/nav.ts` (L66) | Sidebar entry `{ label:"Schedule", href:"/schedule", icon:CalendarClock }` — the only nav entry point. |
| `app/(app)/schedule/page.tsx` | Uses `getProjectDirectory()` (`lib/data/projects.ts`) to enrich the picker. |
| `lib/data/schedule.ts` (header) | Documents intended future coupling to `ProjectPhase` + `PhaseDependency` — currently placeholder/seed-based, not wired. |
| `prisma/schema.prisma` (L1304) | `Project.budget Json?` comment mentions a "schedule coupler" — planned, not implemented. |
| `schedule-app.tsx` | Shared `ProjectPicker`/`ProjectCrumb` + `EmailButton`. |
| `app/print/schedule/[id]/page.tsx` | `getPracticeSettings()` for letterhead. |

**Distinct "schedule impact" concept (NOT this feature):** `scheduleImpactDays`/`scheduleImpact` on change orders & site instructions (`prisma/schema.prisma` L714/L779) and the construction-admin files that use them — delay metadata, not the programme. Do not conflate.

No dashboard widget, task system, or procurement module currently reads `ProjectSchedule`/`ScheduleTask`.

## 12. Terminology & settings

- **Board config** (`ScheduleBoardConfig` in `ProjectSchedule.config` JSON): editable **Categories** `{id,label,color}` (defaults L55–64: Architecture, Structural, Interior, MEP, Project Mgmt, Construction, Orders, Critical); **Sub-categories** per category (construction-activity list, L76–125); **Working calendar** `hoursPerDay` (8), `offDays` default **`[5,6]` = Fri/Sat (UAE weekend)**, `holidays` default **UAE 2026** (L130–136); **`statusDate`** ("data date").
- **Discipline** enum: ARCHITECTURE, STRUCTURAL, INTERIOR, MEP, PROJECT_MANAGEMENT, CONSTRUCTION. **Status** enum: NOT_STARTED, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED (progress auto-syncs 100⇒COMPLETED, 0⇒NOT_STARTED).
- Preserve terms: **Programme** (print title "Project Programme — Gantt"), **critical path / slack**, **SPI**, **schedule variance (days)**, **baseline finish**, **forecast finish / slip**, **status date / data date**. Dependencies are **finish-to-start only** in the shipped Gantt. Duration is **inclusive calendar days** (weekends/holidays shaded but do not shift bars).
- **Budget / EVM (CPI/SPI, BCWP/BCWS/ACWP), cash-flow S-curve, payment milestones** = **"Coming soon"** reserved UI (L997–1039), no implementation.
- Print branding fallback: **"ZenArch"** (`schedule-print.tsx` L275).

---

## Complete file list to protect

```
app/(app)/schedule/page.tsx
app/(app)/schedule/actions.ts
app/print/schedule/[id]/page.tsx
components/schedule/schedule-app.tsx
components/schedule/schedule-gantt.tsx
components/schedule/status-board.tsx
components/schedule/schedule-print.tsx
lib/data/schedule.ts
lib/data/schedule-db.ts
scripts/verify-schedule-persistence.ts
prisma/schema.prisma   (models: ProjectSchedule, ScheduleTask; related: ProjectPhase, PhaseDependency, PhaseAssignment)
lib/nav.ts             (Schedule nav entry, L66)
lib/db.ts              (tenant scoping — ProjectSchedule in TENANT_MODELS)
```

**Shared deps (not schedule-owned, required):** `components/projects/project-picker.tsx`, `components/email/email-button.tsx`, `components/ui/card.tsx`, `components/print/document-letterhead.tsx`, `lib/data/projects.ts` (`getProjectDirectory`), `lib/server/practice-config.ts` (`getPracticeSettings`), `lib/format.ts`, `lib/utils.ts`, `lib/i18n/server.ts`.
