/**
 * What the /progressdash office-TV board (AEC-FLOW · BUILD TIMELINE) says about the
 * build of AEC-flow itself.
 *
 * UPDATED BY HAND — by the owner, or by Claude when work lands (a PR merges, a SQL
 * file is applied, a decision is made). Nothing here is read from the database or
 * from GitHub: every figure is the one that was true on `asOf`, and the board prints
 * "DATA AS OF <asOf>" so a stale screen says so. When you change anything, move
 * `asOf` to that day.
 *
 * Computed on the board, never typed here: the overall % (mean of the phase pcts,
 * lib/progressdash/timeline.ts), the Gantt geometry and today line (from the dates
 * below and today in the office time zone), and the live version + deployed commit
 * (lib/version.ts APP_VERSION, VERCEL_GIT_COMMIT_SHA).
 *
 * Dates are ISO calendar days ("YYYY-MM-DD"), read as days in the office, not instants.
 */

/** NEXT chip: `you` = waiting on the owner (amber), `go` = in hand / next up (cyan), `plain` = later (dashed). */
export type ChipKind = "you" | "go" | "plain";
export type NextChip = { text: string; kind: ChipKind };

/** A run of consecutive days a phase was worked on: `days` days starting on `from`. */
export type WorkedSpan = { from: string; days: number };

export type Phase = {
  code: string;
  name: string;
  /** 0–100, the owner's / Claude's judgement of how much of the phase is built. */
  pct: number;
  worked: WorkedSpan[];
  next: NextChip[];
};

/** Who or what a MISSING item waits on: YOU (amber) or a DECISION / SETUP / VENDOR still to come (grey). */
export type MissingTag = "YOU" | "DECISION" | "SETUP" | "VENDOR";
export type MissingItem = { text: string; tag: MissingTag };

export type Tone = "cyan" | "green" | "amber" | "red";
export type Kpi = { label: string; value: string; tone: Tone };
export type StatItem = { label: string; value: string; tone?: Tone; note?: string };

export type ProgressData = {
  /** The day this content was last made true. */
  asOf: string;
  /** First day of the Gantt axis. */
  start: string;
  phases: Phase[];
  /** Days a release went to production (one diamond each on the LIVE row). */
  releases: string[];
  /** NEXT chips on the LIVE Deploys row. */
  deploysNext: NextChip[];
  workingOn: string[];
  missing: MissingItem[];
  /** Header KPIs after the computed BUILT %. */
  kpis: Kpi[];
  /** AEC-FLOW STATS strip, after the computed LIVE item. */
  stats: StatItem[];
};

export const PROGRESS: ProgressData = {
  asOf: "2026-10-09",
  start: "2026-09-14",
  phases: [
    { code: "P0", name: "Security & tenancy", pct: 100, worked: [{ from: "2026-09-14", days: 2 }], next: [] },
    {
      code: "P1",
      name: "Design · proposals · permits",
      pct: 100,
      worked: [
        { from: "2026-09-16", days: 4 },
        { from: "2026-09-29", days: 2 },
        { from: "2026-10-06", days: 3 },
      ],
      next: [],
    },
    {
      code: "P2",
      name: "Documents & contracts",
      pct: 100,
      worked: [
        { from: "2026-09-22", days: 1 },
        { from: "2026-09-25", days: 1 },
        { from: "2026-09-28", days: 2 },
      ],
      next: [],
    },
    {
      code: "P3",
      name: "Projects & phases",
      pct: 100,
      worked: [
        { from: "2026-09-18", days: 2 },
        { from: "2026-10-07", days: 2 },
      ],
      next: [],
    },
    {
      code: "P4",
      name: "Estimates & take-off",
      pct: 95,
      worked: [
        { from: "2026-09-18", days: 1 },
        { from: "2026-10-01", days: 1 },
        { from: "2026-10-03", days: 2 },
      ],
      next: [],
    },
    {
      code: "P5",
      name: "Finance & accounting",
      pct: 98,
      worked: [
        { from: "2026-09-22", days: 4 },
        { from: "2026-09-28", days: 1 },
        { from: "2026-10-01", days: 1 },
        { from: "2026-10-08", days: 2 },
      ],
      next: [
        { text: "D-6 INVOICE ROLES", kind: "you" },
        { text: "TWO TAXES", kind: "plain" },
      ],
    },
    {
      code: "P6",
      name: "Languages & legal",
      pct: 90,
      worked: [
        { from: "2026-09-27", days: 3 },
        { from: "2026-10-01", days: 1 },
      ],
      next: [{ text: "NAME LEGAL ENTITY", kind: "you" }],
    },
    { code: "P7", name: "Office Dash · TV", pct: 100, worked: [{ from: "2026-10-06", days: 3 }], next: [] },
    {
      code: "P8",
      name: "Billing & launch",
      pct: 15,
      worked: [],
      next: [
        { text: "STRIPE ACCOUNT SETUP", kind: "you" },
        { text: "DEV DATABASE", kind: "plain" },
      ],
    },
  ],
  releases: [
    "2026-09-15",
    "2026-09-16",
    "2026-09-18",
    "2026-09-19",
    "2026-09-22",
    "2026-09-24",
    "2026-09-25",
    "2026-09-26",
    "2026-09-28",
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
    "2026-10-04",
    "2026-10-07",
    "2026-10-08",
    "2026-10-09",
  ],
  deploysNext: [],
  workingOn: [
    "Credit notes, Receivables, Statement of Account — live (0.25.0)",
    "Project FINANCE tab — live (0.23.0)",
    "Expense receipts + overdue chase — live (0.24.0)",
    "This progress board",
  ],
  missing: [
    { text: "Close old PRs #172 #150 #146 #121 #118 #116", tag: "YOU" },
    { text: "D-6: who may issue / void invoices", tag: "YOU" },
    { text: "Stripe products, prices + webhook for AEC-flow billing (D-5 decided: Stripe)", tag: "YOU" },
    { text: "Legal entity + governing law in the Terms", tag: "YOU" },
    { text: "Invoices with two taxes (BBO + BAVP)", tag: "DECISION" },
    { text: "Separate development database", tag: "SETUP" },
    { text: "Error alerting (Sentry or similar)", tag: "VENDOR" },
  ],
  kpis: [
    { label: "PRs SINCE 14 SEP", value: "87", tone: "green" },
    { label: "TESTS PASS", value: "1,617", tone: "cyan" },
    { label: "TO MERGE", value: "0", tone: "green" },
    { label: "SQL WAITING", value: "0", tone: "green" },
  ],
  stats: [
    { label: "PRs merged today", value: "3", note: "#177 #178 #171" },
    { label: "PRs merged since 14 SEP", value: "87" },
    { label: "Unit tests", value: "1,617", note: "all pass" },
    { label: "Database change waiting", value: "NONE", tone: "green", note: "0030 + 0031 applied 9 OCT" },
    { label: "To merge", value: "0", tone: "green", note: "all finance merged" },
    { label: "Languages", value: "7", note: "EN ES NL DE ZH JA PT" },
    { label: "Lockdown checks", value: "5/5", note: "on production" },
    { label: "Billing provider", value: "STRIPE", tone: "green", note: "D-5 decided 10 OCT" },
  ],
};
