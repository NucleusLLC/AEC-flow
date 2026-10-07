import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLINK_DAYS,
  checkDeadlineInput,
  daysUntil,
  deadlineLabel,
  deadlineState,
  deadlineWhen,
  isCalendarDay,
  PERMIT_DEADLINE_KINDS,
  RED_DAYS,
  sortDeadlines,
} from "./deadlines";

const TODAY = "2026-10-07";

describe("thresholds", () => {
  it("are two weeks to red and three days to blinking", () => {
    expect(RED_DAYS).toBe(14);
    expect(BLINK_DAYS).toBe(3);
  });
});

describe("daysUntil", () => {
  it("counts calendar days, either way, across month and year ends", () => {
    expect(daysUntil(TODAY, "2026-10-07")).toBe(0);
    expect(daysUntil(TODAY, "2026-10-17")).toBe(10);
    expect(daysUntil(TODAY, "2026-10-06")).toBe(-1);
    expect(daysUntil("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysUntil("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("ignores any time part", () => {
    expect(daysUntil("2026-10-07T23:59:00Z", "2026-10-08T00:01:00Z")).toBe(1);
  });
});

describe("deadlineState", () => {
  const at = (days: number) => {
    const d = new Date(Date.UTC(2026, 9, 7 + days));
    return d.toISOString().slice(0, 10);
  };

  it("is YELLOW more than 14 days out", () => {
    expect(deadlineState(at(30), TODAY)).toBe("YELLOW");
    expect(deadlineState(at(15), TODAY)).toBe("YELLOW");
  });

  it("turns RED at 14 days and stays red down to 4", () => {
    expect(deadlineState(at(14), TODAY)).toBe("RED");
    expect(deadlineState(at(10), TODAY)).toBe("RED");
    expect(deadlineState(at(4), TODAY)).toBe("RED");
  });

  it("BLINKS at 3 days, on the day, and once overdue", () => {
    expect(deadlineState(at(3), TODAY)).toBe("BLINK");
    expect(deadlineState(at(2), TODAY)).toBe("BLINK");
    expect(deadlineState(at(0), TODAY)).toBe("BLINK");
    expect(deadlineState(at(-1), TODAY)).toBe("BLINK");
    expect(deadlineState(at(-90), TODAY)).toBe("BLINK");
  });
});

describe("deadlineWhen", () => {
  it("speaks military shorthand", () => {
    expect(deadlineWhen(9)).toBe("IN 9D");
    expect(deadlineWhen(1)).toBe("IN 1D");
    expect(deadlineWhen(0)).toBe("TODAY");
    expect(deadlineWhen(-3)).toBe("3D OVERDUE");
  });
});

describe("deadlineLabel", () => {
  it("uses the capital kind label, or the typed label for OTHER", () => {
    expect(deadlineLabel({ kind: "SUBMIT_REVIEW", label: null })).toBe("DEADLINE TO SUBMIT REVIEW");
    expect(deadlineLabel({ kind: "REPLY", label: "ignored" })).toBe("DEADLINE TO REPLY / RESPOND");
    expect(deadlineLabel({ kind: "OTHER", label: " Fire dept. sign-off " })).toBe("FIRE DEPT. SIGN-OFF");
    expect(deadlineLabel({ kind: "OTHER", label: null })).toBe("OTHER");
  });
});

describe("sortDeadlines", () => {
  it("puts the soonest first and is stable on the same day", () => {
    const rows = [
      { id: "c", dueDate: "2026-11-01", kind: "OTHER" as const, label: "B" },
      { id: "a", dueDate: "2026-10-09", kind: "REPLY" as const, label: null },
      { id: "d", dueDate: "2026-11-01", kind: "OTHER" as const, label: "A" },
      { id: "b", dueDate: "2026-11-01", kind: "SUBMIT_REVIEW" as const, label: null },
    ];
    expect(sortDeadlines(rows).map((r) => r.id)).toEqual(["a", "b", "d", "c"]);
  });
});

describe("checkDeadlineInput", () => {
  it("accepts the two fixed kinds and drops any label on them", () => {
    expect(checkDeadlineInput({ kind: "SUBMIT_REVIEW", label: "x", dueDate: "2026-10-20" })).toEqual({
      ok: true,
      value: { kind: "SUBMIT_REVIEW", label: null, dueDate: "2026-10-20" },
    });
    expect(checkDeadlineInput({ kind: "REPLY", dueDate: "2026-10-20" }).ok).toBe(true);
  });

  it("requires a typed label for OTHER, tidied, at most 120 characters", () => {
    expect(checkDeadlineInput({ kind: "OTHER", label: "   ", dueDate: "2026-10-20" })).toEqual({
      ok: false,
      errors: { label: "Type what the deadline is for." },
    });
    expect(checkDeadlineInput({ kind: "OTHER", label: "x".repeat(121), dueDate: "2026-10-20" })).toEqual({
      ok: false,
      errors: { label: "Keep it to 120 characters." },
    });
    expect(checkDeadlineInput({ kind: "OTHER", label: "  Fire   sign-off ", dueDate: "2026-10-20" })).toEqual({
      ok: true,
      value: { kind: "OTHER", label: "Fire sign-off", dueDate: "2026-10-20" },
    });
  });

  it("requires a real date", () => {
    expect(checkDeadlineInput({ kind: "REPLY", dueDate: "" })).toEqual({
      ok: false,
      errors: { dueDate: "Pick the deadline date." },
    });
    expect(checkDeadlineInput({ kind: "REPLY", dueDate: "2026-02-30" })).toEqual({
      ok: false,
      errors: { dueDate: "That is not a valid date." },
    });
  });

  it("refuses an unknown kind and garbage", () => {
    expect(checkDeadlineInput({ kind: "NOPE", dueDate: "2026-10-20" })).toEqual({
      ok: false,
      errors: { kind: "Choose the type of deadline." },
    });
    expect(checkDeadlineInput(null).ok).toBe(false);
  });

  it("knows a calendar day", () => {
    expect(isCalendarDay("2028-02-29")).toBe(true);
    expect(isCalendarDay("2026-02-29")).toBe(false);
    expect(isCalendarDay("1999-12-31")).toBe(false);
    expect(isCalendarDay("2026-1-1")).toBe(false);
  });
});

describe("schema tripwire", () => {
  it("the kinds match enum PermitDeadlineKind in prisma/schema.prisma", () => {
    const schema = readFileSync(resolve(__dirname, "../../prisma/schema.prisma"), "utf8");
    const m = /enum\s+PermitDeadlineKind\s*\{([^}]*)\}/m.exec(schema);
    expect(m).not.toBeNull();
    const values = m![1]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//"));
    expect(values).toEqual([...PERMIT_DEADLINE_KINDS]);
  });
});
