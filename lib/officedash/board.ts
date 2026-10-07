/**
 * Office Dash — the SITREP board for the office TV at /officedash.
 *
 * PURE. No Prisma, no React, no clock: `today` is passed in as `YYYY-MM-DD`, so
 * the same records always give the same board and the tests pin every rule.
 *
 * ─── WHAT IT SHOWS ────────────────────────────────────────────────────────────
 * 1. Engaged projects (ACTIVE, then ON_HOLD), late ones first.
 * 2. Service proposals not signed yet, by stage, and who to chase (oldest first).
 * 3. Building permits still open: submitted, days with the authority, and the
 *    nearest deadline (a letter to answer, a revision to resubmit, the decision
 *    the authority promised, or a DEADLINE set on the file). Every open DEADLINE
 *    also shows on its own strip, yellow / red / blinking red by the permit
 *    module's rule (lib/building-permits/deadlines.ts).
 * 4. ORDERS — open tasks plus actions worked out from the records above, most
 *    urgent first. Until the team logs tasks, the derived orders carry the board.
 */

import { daysUntil, deadlineState, type DeadlineState } from "@/lib/building-permits/deadlines";

export type BoardProject = {
  id: string;
  number: string;
  name: string;
  client: string;
  manager: string;
  status: "ACTIVE" | "ON_HOLD";
  progressPct: number;
  /** The phase IN_PROGRESS, else null. */
  phase: string | null;
  phaseCount: number;
  /** YYYY-MM-DD or null. */
  targetEnd: string | null;
};

export type BoardProposal = {
  id: string;
  number: string;
  title: string;
  client: string | null;
  status: string;
  /** YYYY-MM-DD of the last change (issued date when sent, if known). */
  since: string;
};

export type BoardPermit = {
  id: string;
  reference: string;
  title: string;
  project: string | null;
  status: string;
  authority: string | null;
  version: number | null;
  submittedAt: string | null;
  daysIn: number | null;
  openResponseDueAt: string | null;
  revisionDueAt: string | null;
  targetDecisionAt: string | null;
  /** Open DEADLINES set on the file (the case file's DEADLINE button). */
  deadlines: { label: string; date: string }[];
};

/** One open DEADLINE on a permit file. `label` is already the military label. */
export type BoardDeadline = {
  id: string;
  permitId: string;
  reference: string;
  title: string;
  label: string;
  /** YYYY-MM-DD */
  date: string;
};

export type DeadlineRow = BoardDeadline & { days: number; state: DeadlineState };

export type BoardTask = {
  id: string;
  title: string;
  assignee: string | null;
  dueDate: string | null;
  project: string | null;
  priority: string;
};

export type Lamp = "green" | "amber" | "red" | "off";

export type ProjectRow = BoardProject & { lamp: Lamp; late: boolean; daysToTarget: number | null };

export type DeadlineKind = "REPLY" | "REVISION" | "DECISION" | "DEADLINE";
export type PermitRow = BoardPermit & {
  /** `label` and `state` are set when the nearest is a DEADLINE set on the file. */
  deadline: { kind: DeadlineKind; date: string; days: number; label?: string; state?: DeadlineState } | null;
  urgency: "late" | "soon" | "ok" | "none";
};

export type PipelineStage = "DRAFT" | "TO SEND" | "WITH CLIENT" | "REVISE";
export type ChaseRow = { number: string; title: string; client: string; stage: PipelineStage; waited: number; copies: number };

export type Order = { severity: "red" | "amber" | "info"; text: string; detail: string };

export type Board = {
  today: string;
  counts: {
    engaged: number;
    late: number;
    onHold: number;
    unsigned: number;
    permitsOpen: number;
    tasksOpen: number;
    /** Open DEADLINES, and how many of them are red or blinking. */
    deadlines: number;
    deadlinesRed: number;
  };
  projects: ProjectRow[];
  pipeline: Record<PipelineStage, number>;
  chase: ChaseRow[];
  permits: PermitRow[];
  /** Every open DEADLINE, soonest first. */
  deadlines: DeadlineRow[];
  orders: Order[];
};

/** Proposal statuses that are still in pursuit, and the stage each one shows as. */
export const PIPELINE_STAGE: Record<string, PipelineStage> = {
  DRAFT: "DRAFT",
  INTERNAL_REVIEW: "DRAFT",
  APPROVED_FOR_ISSUE: "TO SEND",
  REVISED: "TO SEND",
  SENT: "WITH CLIENT",
  UNDER_CLIENT_REVIEW: "WITH CLIENT",
  REVISION_REQUESTED: "REVISE",
};

/** Days a deadline counts as "soon" — the permit module's own default reminder. */
export const SOON_DAYS = 7;
/** A permit this long with the authority and not decided gets a chase order. */
export const CHASE_PERMIT_AFTER_DAYS = 60;
/** A proposal with the client this long without an answer gets a follow-up order. */
export const FOLLOW_UP_AFTER_DAYS = 7;

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
/** `2026-10-07` → `07 OCT 2026`; anything else → `—`. */
export function mil(value: string | null | undefined): string {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  return m ? `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : "—";
}

function projectRow(p: BoardProject, today: string): ProjectRow {
  const daysToTarget = p.targetEnd ? daysBetween(today, p.targetEnd) : null;
  const late = p.status === "ACTIVE" && daysToTarget !== null && daysToTarget < 0;
  const lamp: Lamp = p.status === "ON_HOLD" ? "off" : late ? "red" : p.phase ? "green" : "amber";
  return { ...p, lamp, late, daysToTarget };
}

/** The nearest unmet deadline on a permit, with what kind it is. */
export function permitDeadline(p: BoardPermit, today: string): PermitRow["deadline"] {
  const options: { kind: DeadlineKind; date: string | null; label?: string }[] = [
    { kind: "REPLY", date: p.openResponseDueAt },
    { kind: "REVISION", date: p.revisionDueAt },
    { kind: "DECISION", date: p.targetDecisionAt },
    ...(p.deadlines ?? []).map((d) => ({ kind: "DEADLINE" as const, date: d.date, label: d.label })),
  ];
  const best = options
    .filter((o): o is { kind: DeadlineKind; date: string; label?: string } => Boolean(o.date))
    .sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)))[0];
  if (!best) return null;
  const date = best.date.slice(0, 10);
  const out: NonNullable<PermitRow["deadline"]> = { kind: best.kind, date, days: daysBetween(today, date) };
  if (best.kind === "DEADLINE") Object.assign(out, { label: best.label, state: deadlineState(date, today) });
  return out;
}

/** Every open DEADLINE with its days and colour, soonest first. */
export function deadlineRows(deadlines: BoardDeadline[], today: string): DeadlineRow[] {
  return deadlines
    .map((d) => ({ ...d, date: d.date.slice(0, 10), days: daysUntil(today, d.date), state: deadlineState(d.date, today) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference) || a.label.localeCompare(b.label));
}

function permitRow(p: BoardPermit, today: string): PermitRow {
  const deadline = permitDeadline(p, today);
  const urgency = !deadline ? "none" : deadline.days < 0 ? "late" : deadline.days <= SOON_DAYS ? "soon" : "ok";
  return { ...p, deadline, urgency };
}

const URGENCY_RANK = { late: 0, soon: 1, ok: 2, none: 3 } as const;

/**
 * Fold duplicate drafts (same title, client and stage) into one line, so eight
 * copies of one proposal do not fill the chase list.
 */
export function chaseList(proposals: BoardProposal[], today: string): ChaseRow[] {
  const groups = new Map<string, ChaseRow>();
  for (const p of proposals) {
    const stage = PIPELINE_STAGE[p.status];
    if (!stage) continue;
    const client = p.client?.trim() || "No client";
    const key = `${stage}|${client.toLowerCase()}|${p.title.trim().toLowerCase()}`;
    const waited = Math.max(0, daysBetween(p.since, today));
    const seen = groups.get(key);
    if (seen) {
      seen.copies += 1;
      // Keep the most recent copy's number and age: that is the one being worked on.
      if (waited < seen.waited) Object.assign(seen, { number: p.number, waited });
    } else {
      groups.set(key, { number: p.number, title: p.title, client, stage, waited, copies: 1 });
    }
  }
  const order: Record<PipelineStage, number> = { "WITH CLIENT": 0, "TO SEND": 1, REVISE: 2, DRAFT: 3 };
  return [...groups.values()].sort((a, b) => order[a.stage] - order[b.stage] || b.waited - a.waited);
}

export function buildBoard(input: {
  today: string;
  projects: BoardProject[];
  proposals: BoardProposal[];
  permits: BoardPermit[];
  tasks: BoardTask[];
  /** Every open DEADLINE in the practice (optional so older callers still build). */
  deadlines?: BoardDeadline[];
}): Board {
  const { today } = input;
  const deadlines = deadlineRows(input.deadlines ?? [], today);
  const projects = input.projects
    .map((p) => projectRow(p, today))
    .sort(
      (a, b) =>
        Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE") ||
        Number(b.late) - Number(a.late) ||
        (a.daysToTarget ?? 1e9) - (b.daysToTarget ?? 1e9) ||
        b.progressPct - a.progressPct ||
        a.number.localeCompare(b.number),
    );
  const engaged = projects.filter((p) => p.status === "ACTIVE");

  const pipeline: Record<PipelineStage, number> = { DRAFT: 0, "TO SEND": 0, "WITH CLIENT": 0, REVISE: 0 };
  const chase = chaseList(input.proposals, today);
  for (const c of chase) pipeline[c.stage] += 1;

  const permits = input.permits
    .map((p) => permitRow(p, today))
    .sort(
      (a, b) =>
        URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] ||
        (a.deadline?.days ?? 1e9) - (b.deadline?.days ?? 1e9) ||
        (b.daysIn ?? -1) - (a.daysIn ?? -1),
    );

  const orders: Order[] = [];
  const tasks = [...input.tasks].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  for (const t of tasks) {
    const days = t.dueDate ? daysBetween(today, t.dueDate) : null;
    const who = t.assignee ? ` — ${t.assignee}` : "";
    orders.push({
      severity: days !== null && days < 0 ? "red" : days !== null && days <= 1 ? "amber" : "info",
      text: `${t.title}${who}`,
      detail: [t.project, days === null ? "no due date" : days < 0 ? `${-days}D OVERDUE` : days === 0 ? "DUE TODAY" : `due ${mil(t.dueDate)}`]
        .filter(Boolean)
        .join(" · "),
    });
  }
  // Red and blinking DEADLINES are orders of their own, one per deadline.
  for (const d of deadlines.filter((x) => x.state !== "YELLOW")) {
    orders.push({
      severity: "red",
      text: `${d.label} — permit ${d.reference}`,
      detail: `${d.days < 0 ? `${-d.days}D OVERDUE` : d.days === 0 ? "TODAY" : `in ${d.days}D`} · ${mil(d.date)}`,
    });
  }
  for (const p of permits) {
    // A DEADLINE set on the file already has its own order above.
    if (p.deadline?.kind === "DEADLINE") {
      if (p.daysIn !== null && p.daysIn >= CHASE_PERMIT_AFTER_DAYS && p.deadline.state === "YELLOW") {
        orders.push({ severity: "info", text: `CHASE AUTHORITY — permit ${p.reference}`, detail: `${p.daysIn}D with ${p.authority ?? "the authority"}` });
      }
      continue;
    }
    if (p.deadline && p.urgency !== "ok") {
      const what = p.deadline.kind === "REPLY" ? "ANSWER LETTER" : p.deadline.kind === "REVISION" ? "RESUBMIT" : "DECISION DUE";
      orders.push({
        severity: p.urgency === "late" ? "red" : "amber",
        text: `${what} — permit ${p.reference}`,
        detail: `${p.deadline.days < 0 ? `${-p.deadline.days}D LATE` : p.deadline.days === 0 ? "TODAY" : `in ${p.deadline.days}D`} · ${mil(p.deadline.date)}`,
      });
    } else if (p.daysIn !== null && p.daysIn >= CHASE_PERMIT_AFTER_DAYS) {
      orders.push({ severity: "info", text: `CHASE AUTHORITY — permit ${p.reference}`, detail: `${p.daysIn}D with ${p.authority ?? "the authority"}` });
    }
  }
  for (const p of engaged.filter((x) => x.late)) {
    orders.push({ severity: "red", text: `PAST TARGET — ${p.name}`, detail: `${-(p.daysToTarget ?? 0)}D · ${p.number} · ${p.manager}` });
  }
  for (const c of chase.filter((x) => x.stage === "WITH CLIENT" && x.waited >= FOLLOW_UP_AFTER_DAYS)) {
    orders.push({ severity: "amber", text: `FOLLOW UP — ${c.client}`, detail: `${c.number} · ${c.waited}D, no answer` });
  }
  for (const c of chase.filter((x) => x.stage === "REVISE")) {
    orders.push({ severity: "amber", text: `REVISE PROPOSAL — ${c.client}`, detail: `${c.number} · client asked ${c.waited}D ago` });
  }
  const toSend = chase.filter((x) => x.stage === "TO SEND");
  if (toSend.length) {
    orders.push({ severity: "info", text: `SEND ${toSend.length} APPROVED PROPOSAL${toSend.length > 1 ? "S" : ""}`, detail: toSend.map((x) => x.client).join(", ") });
  }
  const noPhase = engaged.filter((p) => p.phaseCount === 0 || (!p.phase && p.progressPct === 0)).length;
  if (noPhase) orders.push({ severity: "info", text: `SET PHASES ON ${noPhase} PROJECT${noPhase > 1 ? "S" : ""}`, detail: "progress cannot move until a phase is running" });

  const rank = { red: 0, amber: 1, info: 2 } as const;
  orders.sort((a, b) => rank[a.severity] - rank[b.severity]);

  return {
    today,
    counts: {
      engaged: engaged.length,
      late: engaged.filter((p) => p.late).length,
      onHold: projects.length - engaged.length,
      unsigned: chase.length,
      permitsOpen: permits.length,
      tasksOpen: input.tasks.length,
      deadlines: deadlines.length,
      deadlinesRed: deadlines.filter((d) => d.state !== "YELLOW").length,
    },
    projects,
    pipeline,
    chase,
    permits,
    deadlines,
    orders,
  };
}

/** Split rows into fixed-size pages for the TV's rotation. Always at least one page. */
export function pages<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
