/**
 * The permit Process Summary (SITREP): one chronology of everything that has
 * happened on a file, the situation it adds up to, and the actions still open.
 *
 * PURE: a case file and a date in, a summary out. The print route renders it;
 * the AI synopsis is given `dossier()` — the same facts, as text — and nothing
 * else, so the synopsis cannot mention an event this summary does not show.
 *
 * Dates are the house military form, 16 SEP 2026 (militaryDate).
 */
import { lapsedMonths, militaryDate, permitVersion } from "./register";
import {
  APPROVAL_STAGE_LABEL,
  APPROVAL_STATUS_LABEL,
  PERMIT_STATUS_LABEL,
  PERMIT_TYPE_LABEL,
  SUBMISSION_METHOD_LABEL,
  type BuildingPermitDTO,
} from "./types";

export type ProcessEventKind =
  | "APPLICATION"
  | "VERSION"
  | "MEETING"
  | "LETTER_IN"
  | "LETTER_OUT"
  | "APPROVAL"
  | "MILESTONE";

export type ProcessEvent = {
  /** yyyy-mm-dd */
  date: string;
  kind: ProcessEventKind;
  /** English key with {slots}, translated at render. */
  what: string;
  /** Slot values. Strings are English labels (translated at render) or numbers. */
  vars: Record<string, string | number>;
  /** Free text from the file (subject, contents, decision) — never translated. */
  detail: string | null;
};

/** English labels for each kind; the print route translates them. */
export const PROCESS_EVENT_LABEL: Record<ProcessEventKind, string> = {
  APPLICATION: "Application",
  VERSION: "Revision submitted",
  MEETING: "Meeting",
  LETTER_IN: "Letter received",
  LETTER_OUT: "Letter sent",
  APPROVAL: "Approval stage",
  MILESTONE: "Milestone",
};

export type OpenAction = {
  /** English key with {slots}, filled by fmt at render. */
  what: string;
  vars: Record<string, string | number>;
  /** yyyy-mm-dd, when the action has a deadline. */
  dueAt: string | null;
  overdue: boolean;
};

export type ProcessFacts = {
  status: string;
  version: number | null;
  daysInProcess: number | null;
  monthsLapsed: number | null;
  versions: number;
  meetings: number;
  lettersIn: number;
  lettersOut: number;
  approvalsDecided: number;
  approvalsPending: number;
  lastEvent: ProcessEvent | null;
};

export type ProcessSummary = {
  facts: ProcessFacts;
  timeline: ProcessEvent[];
  openActions: OpenAction[];
};

const day = (s: string | null | undefined): string | null => (s ? s.slice(0, 10) : null);

/** Whole days from `from` to `to`, both yyyy-mm-dd, ignoring clocks and DST. */
export function dayDiff(from: string, to: string): number {
  const utc = (x: string) => {
    const [y, m, d] = x.slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** Every dated event on the file, oldest first; undated ones are left out. */
export function processTimeline(p: BuildingPermitDTO): ProcessEvent[] {
  const events: ProcessEvent[] = [];
  const push = (
    date: string | null,
    kind: ProcessEventKind,
    what: string,
    detail: string | null,
    vars: Record<string, string | number> = {},
  ) => {
    if (date) events.push({ date, kind, what, vars, detail: detail?.trim() || null });
  };

  // The first version is the application; the rest are revisions.
  const versions = [...p.submissions].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  versions.forEach((s, i) =>
    push(
      day(s.submittedAt),
      i === 0 ? "APPLICATION" : "VERSION",
      "V{n} submitted ({method})",
      [s.contents, s.receiptNumber ? `#${s.receiptNumber}` : null].filter(Boolean).join(" — ") || null,
      { n: i + 1, method: SUBMISSION_METHOD_LABEL[s.method] },
    ),
  );
  if (versions.length === 0) push(day(p.submittedAt), "APPLICATION", "Application submitted", null);

  push(day(p.acknowledgedAt), "MILESTONE", "Acknowledged by the authority", null);
  push(day(p.conceptApprovalAt), "MILESTONE", "Concept approval", p.conceptApprovalRef);
  push(day(p.decisionAt), "MILESTONE", "Decision", null);
  push(day(p.issuedAt), "MILESTONE", "Permit ready", p.permitNumber);
  push(day(p.feePaidAt), "MILESTONE", "Fee paid", null);

  for (const m of p.meetings) {
    push(day(m.heldAt), "MEETING", "Meeting", [m.subject, m.decisions].filter(Boolean).join(" — "));
  }
  for (const l of p.correspondence) {
    const inbound = l.direction === "INCOMING";
    push(
      day(l.letterDate ?? l.receivedAt),
      inbound ? "LETTER_IN" : "LETTER_OUT",
      inbound ? "Letter received" : "Letter sent",
      [l.letterRef, l.party, l.subject].filter(Boolean).join(" · "),
    );
  }
  for (const a of p.approvals) {
    push(
      day(a.decidedAt),
      "APPROVAL",
      "{stage}: {status}",
      [a.refNumber, a.conditions].filter(Boolean).join(" — ") || null,
      { stage: APPROVAL_STAGE_LABEL[a.stage], status: APPROVAL_STATUS_LABEL[a.status] },
    );
  }

  // Stable: same-day events keep the order they were gathered in.
  return events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => a.e.date.localeCompare(b.e.date) || a.i - b.i)
    .map(({ e }) => e);
}

/** What is still owed, by us or by the authority, most urgent first. */
export function openActions(p: BuildingPermitDTO, today: string): OpenAction[] {
  const out: OpenAction[] = [];
  for (const l of p.correspondence) {
    if (l.direction !== "INCOMING" || !l.requiresResponse || l.respondedAt) continue;
    const due = day(l.responseDueAt);
    out.push({
      what: "Reply to {party} letter {ref}: {subject}",
      vars: { party: l.party ?? "—", ref: l.letterRef ?? "—", subject: l.subject },
      dueAt: due,
      overdue: due ? dayDiff(today, due) < 0 : false,
    });
  }
  for (const a of p.approvals) {
    if (a.status !== "PENDING") continue;
    out.push({
      what: "Awaiting {stage} approval",
      vars: { stage: APPROVAL_STAGE_LABEL[a.stage] },
      dueAt: null,
      overdue: false,
    });
  }
  for (const m of p.meetings) {
    if (!m.followUp?.trim()) continue;
    out.push({
      what: "Follow up from meeting {date}: {action}",
      vars: { date: militaryDate(m.heldAt), action: m.followUp.trim() },
      dueAt: null,
      overdue: false,
    });
  }
  return out.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
    return a.dueAt ? -1 : b.dueAt ? 1 : 0;
  });
}

export function processSummary(p: BuildingPermitDTO, today: string): ProcessSummary {
  const timeline = processTimeline(p);
  const version = permitVersion(p);
  const lapsed = lapsedMonths(p, today);
  const start = day(p.submittedAt) ?? timeline.find((e) => e.kind === "APPLICATION")?.date ?? null;
  const end = day(p.issuedAt) ?? today;
  return {
    facts: {
      status: PERMIT_STATUS_LABEL[p.status],
      version: version?.version ?? null,
      daysInProcess: start ? Math.max(0, dayDiff(start, end)) : null,
      monthsLapsed: lapsed ? Number(lapsed.months.toFixed(1)) : null,
      versions: p.submissions.length,
      meetings: p.meetings.length,
      lettersIn: p.correspondence.filter((l) => l.direction === "INCOMING").length,
      lettersOut: p.correspondence.filter((l) => l.direction === "OUTGOING").length,
      approvalsDecided: p.approvals.filter((a) => a.status !== "PENDING").length,
      approvalsPending: p.approvals.filter((a) => a.status === "PENDING").length,
      lastEvent: timeline.at(-1) ?? null,
    },
    timeline,
    openActions: openActions(p, today),
  };
}

/** Fill {slots} for the dossier; the print route uses fmt(t(...)) instead. */
const fill = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/**
 * The file as plain text, for the AI synopsis. Everything the model may say
 * comes from here; free-text fields are included as written.
 */
export function dossier(p: BuildingPermitDTO, today: string): string {
  const s = processSummary(p, today);
  const f = s.facts;
  const lines: string[] = [
    `TODAY: ${militaryDate(today)}`,
    `FILE: ${p.reference}${p.permitNumber ? ` / authority no. ${p.permitNumber}` : ""} — ${p.title}`,
    `TYPE: ${PERMIT_TYPE_LABEL[p.permitType]}`,
    `STATUS: ${f.status}`,
    `AUTHORITY: ${p.authority ?? "not recorded"}${p.authorityContact ? ` (${p.authorityContact})` : ""}`,
    `SITE: ${[p.siteAddress, p.parcelNumber ? `parcel ${p.parcelNumber}` : null].filter(Boolean).join(", ") || "not recorded"}`,
    `APPLICANT: ${p.applicantName ?? "not recorded"}`,
    `CURRENT VERSION: ${f.version ? `V${f.version}` : "none submitted"}`,
    `DAYS IN PROCESS: ${f.daysInProcess ?? "not started"}`,
    `TARGET DECISION: ${militaryDate(p.targetDecisionAt)}`,
    `EXPIRES: ${militaryDate(p.expiresAt)}`,
    `COUNTS: ${f.versions} versions, ${f.meetings} meetings, ${f.lettersIn} letters received, ${f.lettersOut} letters sent, ${f.approvalsDecided} approvals decided, ${f.approvalsPending} pending`,
    "",
    "CHRONOLOGY:",
    ...(s.timeline.length
      ? s.timeline.map(
          (e, i) =>
            `${i + 1}. ${militaryDate(e.date)} — ${fill(e.what, e.vars)}${e.detail ? `: ${e.detail}` : ""}`,
        )
      : ["(no dated events)"]),
    "",
    "MEETING DECISIONS AND FOLLOW-UPS:",
    ...(p.meetings.length
      ? p.meetings.map(
          (m) =>
            `- ${militaryDate(m.heldAt)} ${m.subject}${m.decisions ? ` | decisions: ${m.decisions}` : ""}${m.followUp ? ` | follow-up: ${m.followUp}` : ""}`,
        )
      : ["(none)"]),
    "",
    "LETTER SUMMARIES:",
    ...(p.correspondence.filter((l) => l.summary).length
      ? p.correspondence
          .filter((l) => l.summary)
          .map((l) => `- ${militaryDate(l.letterDate ?? l.receivedAt)} ${l.direction === "INCOMING" ? "IN" : "OUT"} ${l.subject}: ${l.summary}`)
      : ["(none)"]),
    "",
    "OPEN ACTIONS:",
    ...(s.openActions.length
      ? s.openActions.map(
          (a) => `- ${fill(a.what, a.vars)}${a.dueAt ? ` — due ${militaryDate(a.dueAt)}${a.overdue ? " (OVERDUE)" : ""}` : ""}`,
        )
      : ["(none)"]),
  ];
  if (p.notes?.trim()) lines.push("", `FILE NOTES: ${p.notes.trim()}`);
  return lines.join("\n");
}

