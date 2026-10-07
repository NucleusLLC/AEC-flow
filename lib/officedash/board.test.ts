import { describe, expect, it } from "vitest";
import {
  buildBoard,
  chaseList,
  daysBetween,
  deadlineRows,
  mil,
  pages,
  permitDeadline,
  type BoardDeadline,
  type BoardPermit,
  type BoardProject,
} from "./board";

const TODAY = "2026-10-07";

const project = (o: Partial<BoardProject>): BoardProject => ({
  id: o.number ?? "p",
  number: "ZA-1",
  name: "House",
  client: "Client",
  manager: "PM",
  status: "ACTIVE",
  progressPct: 0,
  phase: null,
  phaseCount: 0,
  targetEnd: null,
  ...o,
});

const permit = (o: Partial<BoardPermit>): BoardPermit => ({
  id: o.reference ?? "bp",
  reference: "BP-2026-001",
  title: "New house",
  project: null,
  status: "SUBMITTED",
  authority: "DOW",
  version: 1,
  submittedAt: "2026-09-01",
  daysIn: 36,
  openResponseDueAt: null,
  revisionDueAt: null,
  targetDecisionAt: null,
  deadlines: [],
  ...o,
});

describe("dates", () => {
  it("counts whole days and prints military dates", () => {
    expect(daysBetween("2026-10-01", TODAY)).toBe(6);
    expect(daysBetween(TODAY, "2026-07-03")).toBe(-96);
    expect(mil("2026-10-07")).toBe("07 OCT 2026");
    expect(mil(null)).toBe("—");
  });
});

describe("projects", () => {
  it("puts late active projects first, hold last, and lights the lamp", () => {
    const b = buildBoard({
      today: TODAY,
      projects: [
        project({ number: "A", targetEnd: "2026-12-01", phase: "Concept", phaseCount: 3 }),
        project({ number: "B", status: "ON_HOLD", targetEnd: "2026-01-01" }),
        project({ number: "C", targetEnd: "2026-07-03" }),
        project({ number: "D" }),
      ],
      proposals: [],
      permits: [],
      tasks: [],
    });
    expect(b.projects.map((p) => [p.number, p.lamp])).toEqual([
      ["C", "red"],
      ["A", "green"],
      ["D", "amber"],
      ["B", "off"],
    ]);
    expect(b.counts).toMatchObject({ engaged: 3, late: 1, onHold: 1 });
    // An on-hold project past its date is not counted late.
    expect(b.projects.find((p) => p.number === "B")!.late).toBe(false);
  });
});

describe("pipeline", () => {
  it("folds duplicate drafts and keeps the newest copy", () => {
    const rows = chaseList(
      [
        { id: "1", number: "SP-020", title: "Kamay 33", client: "Van Trikt", status: "DRAFT", since: "2026-09-18" },
        { id: "2", number: "SP-027", title: "Kamay 33 ", client: "van trikt", status: "DRAFT", since: "2026-09-19" },
        { id: "3", number: "2026A-019", title: "Kamay 33", client: "Van Trikt", status: "SENT", since: "2026-09-19" },
        { id: "4", number: "X", title: "Won", client: "Y", status: "ACCEPTED", since: "2026-09-01" },
      ],
      TODAY,
    );
    expect(rows).toEqual([
      { number: "2026A-019", title: "Kamay 33", client: "Van Trikt", stage: "WITH CLIENT", waited: 18, copies: 1 },
      { number: "SP-027", title: "Kamay 33", client: "Van Trikt", stage: "DRAFT", waited: 18, copies: 2 },
    ]);
  });
});

describe("permits", () => {
  it("picks the nearest deadline and names its kind", () => {
    expect(permitDeadline(permit({ revisionDueAt: "2026-10-20", openResponseDueAt: "2026-10-10" }), TODAY)).toEqual({
      kind: "REPLY",
      date: "2026-10-10",
      days: 3,
    });
    expect(permitDeadline(permit({}), TODAY)).toBeNull();
  });

  it("orders late, then soon, then the rest by days in", () => {
    const b = buildBoard({
      today: TODAY,
      projects: [],
      proposals: [],
      tasks: [],
      permits: [
        permit({ reference: "OLD", daysIn: 153 }),
        permit({ reference: "SOON", revisionDueAt: "2026-10-12" }),
        permit({ reference: "LATE", openResponseDueAt: "2026-10-01" }),
        permit({ reference: "LATER", targetDecisionAt: "2026-12-01" }),
      ],
    });
    expect(b.permits.map((p) => [p.reference, p.urgency])).toEqual([
      ["LATE", "late"],
      ["SOON", "soon"],
      ["LATER", "ok"],
      ["OLD", "none"],
    ]);
    const texts = b.orders.map((o) => o.text);
    expect(texts).toContain("ANSWER LETTER — permit LATE");
    expect(texts).toContain("RESUBMIT — permit SOON");
    expect(texts).toContain("CHASE AUTHORITY — permit OLD");
    expect(texts.some((t) => t.includes("LATER"))).toBe(false);
  });
});

describe("permit DEADLINES", () => {
  const dl = (o: Partial<BoardDeadline>): BoardDeadline => ({
    id: o.label ?? "d",
    permitId: "bp",
    reference: "BP-2026-001",
    title: "New house",
    label: "DEADLINE TO SUBMIT REVIEW",
    date: "2026-11-06",
    ...o,
  });

  it("colours each one yellow / red / blink and sorts soonest first", () => {
    const rows = deadlineRows(
      [
        dl({ label: "YELLOW 30", date: "2026-11-06" }),
        dl({ label: "RED 10", date: "2026-10-17" }),
        dl({ label: "BLINK 2", date: "2026-10-09" }),
        dl({ label: "BLINK -1", date: "2026-10-06" }),
        dl({ label: "RED 14", date: "2026-10-21" }),
        dl({ label: "YELLOW 15", date: "2026-10-22" }),
      ],
      TODAY,
    );
    expect(rows.map((r) => [r.label, r.days, r.state])).toEqual([
      ["BLINK -1", -1, "BLINK"],
      ["BLINK 2", 2, "BLINK"],
      ["RED 10", 10, "RED"],
      ["RED 14", 14, "RED"],
      ["YELLOW 15", 15, "YELLOW"],
      ["YELLOW 30", 30, "YELLOW"],
    ]);
  });

  it("take part in NEXT DEADLINE when they are the nearest", () => {
    const p = permit({
      targetDecisionAt: "2026-12-01",
      deadlines: [{ label: "FIRE SIGN-OFF", date: "2026-10-09" }],
    });
    expect(permitDeadline(p, TODAY)).toEqual({ kind: "DEADLINE", date: "2026-10-09", days: 2, label: "FIRE SIGN-OFF", state: "BLINK" });
    // A nearer letter still wins.
    expect(permitDeadline({ ...p, openResponseDueAt: "2026-10-08" }, TODAY)).toMatchObject({ kind: "REPLY", days: 1 });
  });

  it("puts red and blinking ones on the board and in the orders, yellow ones not in the orders", () => {
    const b = buildBoard({
      today: TODAY,
      projects: [],
      proposals: [],
      tasks: [],
      permits: [permit({ id: "bp", deadlines: [{ label: "DEADLINE TO REPLY / RESPOND", date: "2026-10-06" }] })],
      deadlines: [
        dl({ label: "DEADLINE TO REPLY / RESPOND", date: "2026-10-06" }),
        dl({ label: "DEADLINE TO SUBMIT REVIEW", date: "2026-10-17" }),
        dl({ label: "FIRE SIGN-OFF", date: "2026-11-06" }),
      ],
    });
    expect(b.deadlines.map((d) => d.state)).toEqual(["BLINK", "RED", "YELLOW"]);
    expect(b.counts).toMatchObject({ deadlines: 3, deadlinesRed: 2 });
    expect(b.orders.filter((o) => o.text.includes("BP-2026-001")).map((o) => [o.severity, o.text, o.detail])).toEqual([
      ["red", "DEADLINE TO REPLY / RESPOND — permit BP-2026-001", "1D OVERDUE · 06 OCT 2026"],
      ["red", "DEADLINE TO SUBMIT REVIEW — permit BP-2026-001", "in 10D · 17 OCT 2026"],
    ]);
    expect(b.permits[0].deadline).toMatchObject({ kind: "DEADLINE", state: "BLINK" });
  });

  it("is empty when nothing is set", () => {
    const b = buildBoard({ today: TODAY, projects: [], proposals: [], tasks: [], permits: [] });
    expect(b.deadlines).toEqual([]);
    expect(b.counts).toMatchObject({ deadlines: 0, deadlinesRed: 0 });
  });
});

describe("orders", () => {
  it("lists red before amber before info, tasks included", () => {
    const b = buildBoard({
      today: TODAY,
      projects: [project({ number: "C", name: "Late house", targetEnd: "2026-07-03" }), project({ number: "D" })],
      proposals: [
        { id: "1", number: "S1", title: "T", client: "Chase me", status: "SENT", since: "2026-09-19" },
        { id: "2", number: "S2", title: "U", client: "Send me", status: "APPROVED_FOR_ISSUE", since: "2026-09-16" },
      ],
      permits: [],
      tasks: [
        { id: "t1", title: "Call DOW", assignee: "Greg", dueDate: "2026-10-05", project: null, priority: "HIGH" },
        { id: "t2", title: "Print set", assignee: null, dueDate: null, project: "Late house", priority: "MEDIUM" },
      ],
    });
    expect(b.orders.map((o) => [o.severity, o.text])).toEqual([
      ["red", "Call DOW — Greg"],
      ["red", "PAST TARGET — Late house"],
      ["amber", "FOLLOW UP — Chase me"],
      ["info", "Print set"],
      ["info", "SEND 1 APPROVED PROPOSAL"],
      ["info", "SET PHASES ON 2 PROJECTS"],
    ]);
    expect(b.counts.tasksOpen).toBe(2);
  });
});

describe("pages", () => {
  it("splits into fixed pages and never returns none", () => {
    expect(pages([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(pages([], 3)).toEqual([[]]);
  });
});
