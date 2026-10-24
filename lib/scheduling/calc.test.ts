import { describe, expect, it } from "vitest";
import {
  awaitingCompletion,
  canDelete,
  effectiveHours,
  formatHours,
  groupByDay,
  hhmm,
  monthRange,
  nextAppointmentNumber,
  plannedHours,
  registerTiles,
  splitUpcoming,
  splitWallClock,
  summarize,
  timesheetBlocker,
  timesheetTargets,
  toWallClockUtc,
  wallClockNow,
  weekRange,
  type Timed,
} from "./calc";

const at = (date: string, time: string) => toWallClockUtc(date, time)!.toISOString();

function appt(over: Partial<Timed> & { date?: string; start?: string; end?: string } = {}): Timed {
  const date = over.date ?? "2026-10-19";
  return {
    type: over.type ?? "INSPECTION",
    status: over.status ?? "SCHEDULED",
    startsAt: over.startsAt ?? at(date, over.start ?? "09:00"),
    endsAt: over.endsAt ?? at(date, over.end ?? "11:00"),
    actualHours: over.actualHours ?? null,
  };
}

describe("wall-clock times stored as UTC", () => {
  it("stores 09:00 as 09:00Z and reads it back unchanged", () => {
    const d = toWallClockUtc("2026-10-19", "09:00")!;
    expect(d.toISOString()).toBe("2026-10-19T09:00:00.000Z");
    expect(splitWallClock(d)).toEqual({ date: "2026-10-19", time: "09:00" });
    expect(hhmm(d.toISOString())).toBe("09:00");
  });

  it("refuses times and dates that do not exist", () => {
    expect(toWallClockUtc("2026-02-31", "09:00")).toBeNull();
    expect(toWallClockUtc("2026-10-19", "24:00")).toBeNull();
    expect(toWallClockUtc("2026-10-19", "9:00")).toBeNull();
    expect(toWallClockUtc("19-10-2026", "09:00")).toBeNull();
  });

  it("turns a real instant into the office's wall clock in the same frame", () => {
    // 13:30 UTC is 09:30 in Aruba (UTC−4, no daylight saving).
    const now = new Date("2026-10-19T13:30:00.000Z");
    expect(wallClockNow(now, "America/Aruba").toISOString()).toBe("2026-10-19T09:30:00.000Z");
    expect(wallClockNow(now, "UTC").toISOString()).toBe("2026-10-19T13:30:00.000Z");
  });
});

describe("hours", () => {
  it("plans the hours from start to end", () => {
    expect(plannedHours(at("2026-10-19", "09:00"), at("2026-10-19", "11:30"))).toBe(2.5);
    expect(plannedHours(at("2026-10-19", "11:00"), at("2026-10-19", "09:00"))).toBe(0);
  });

  it("counts actual hours for a completed visit, planned when none were entered", () => {
    expect(effectiveHours(appt({ status: "COMPLETED", actualHours: 2.5 }))).toBe(2.5);
    expect(effectiveHours(appt({ status: "COMPLETED" }))).toBe(2);
  });

  it("counts nothing for a visit that has not happened or never will", () => {
    expect(effectiveHours(appt({ status: "SCHEDULED", actualHours: 3 }))).toBe(0);
    expect(effectiveHours(appt({ status: "CANCELLED" }))).toBe(0);
    expect(effectiveHours(appt({ status: "POSTPONED" }))).toBe(0);
  });

  it("formats hours without trailing zeros", () => {
    expect(formatHours(2.5)).toBe("2.5 h");
    expect(formatHours(3)).toBe("3 h");
    expect(formatHours(1.25)).toBe("1.25 h");
    expect(formatHours(0)).toBe("0 h");
  });
});

describe("upcoming and past", () => {
  const now = new Date(at("2026-10-19", "12:00"));

  it("puts open visits still ahead in upcoming, soonest first", () => {
    const later = appt({ date: "2026-10-22" });
    const sooner = appt({ date: "2026-10-20" });
    const done = appt({ date: "2026-10-18", status: "COMPLETED" });
    const { upcoming, past } = splitUpcoming([later, done, sooner], now);
    expect(upcoming).toEqual([sooner, later]);
    expect(past).toEqual([done]);
  });

  it("treats an open visit whose end has passed as past, awaiting completion", () => {
    const missed = appt({ date: "2026-10-19", start: "08:00", end: "10:00" });
    const { upcoming, past } = splitUpcoming([missed], now);
    expect(upcoming).toEqual([]);
    expect(past).toEqual([missed]);
    expect(awaitingCompletion(missed, now)).toBe(true);
    expect(awaitingCompletion(appt({ status: "COMPLETED", start: "08:00", end: "10:00" }), now)).toBe(false);
  });

  it("keeps a visit in progress in upcoming", () => {
    const ongoing = appt({ start: "11:00", end: "13:00" });
    expect(splitUpcoming([ongoing], now).upcoming).toEqual([ongoing]);
  });

  it("groups by calendar day in the order given", () => {
    const a = appt({ date: "2026-10-20", start: "08:00" });
    const b = appt({ date: "2026-10-20", start: "14:00" });
    const c = appt({ date: "2026-10-21" });
    expect(groupByDay([a, b, c])).toEqual([
      { date: "2026-10-20", items: [a, b] },
      { date: "2026-10-21", items: [c] },
    ]);
  });
});

describe("summaries", () => {
  const now = new Date(at("2026-10-19", "12:00"));

  it("adds completed hours by type and counts what is still to come", () => {
    const s = summarize(
      [
        appt({ type: "INSPECTION", status: "COMPLETED", actualHours: 2.5, date: "2026-10-01" }),
        appt({ type: "INSPECTION", status: "COMPLETED", date: "2026-10-02" }),
        appt({ type: "MEASURING", status: "COMPLETED", actualHours: 1, date: "2026-10-03" }),
        appt({ type: "MEETING", status: "CANCELLED", date: "2026-10-04" }),
        appt({ type: "SUPERVISION", date: "2026-10-25" }),
        appt({ type: "SUPERVISION", status: "POSTPONED", date: "2026-10-26" }),
      ],
      now,
    );
    expect(s.completedCount).toBe(3);
    expect(s.completedHours).toBe(5.5);
    expect(s.upcomingCount).toBe(2);
    expect(s.cancelledCount).toBe(1);
    expect(s.byType.find((r) => r.type === "INSPECTION")).toEqual({ type: "INSPECTION", count: 2, hours: 4.5 });
    expect(s.byType.find((r) => r.type === "MEASURING")).toEqual({ type: "MEASURING", count: 1, hours: 1 });
    expect(s.byType.map((r) => r.type)).toEqual([
      "MEETING",
      "INSPECTION",
      "MEASURING",
      "SUPERVISION",
      "SITE_VISIT",
      "OTHER",
    ]);
  });

  it("runs the week Monday to Monday and the month first to first", () => {
    // 19 OCT 2026 is a Monday.
    expect(weekRange(new Date(at("2026-10-21", "15:00")))).toEqual({
      from: new Date("2026-10-19T00:00:00.000Z"),
      to: new Date("2026-10-26T00:00:00.000Z"),
    });
    expect(weekRange(new Date(at("2026-10-25", "23:00"))).from.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(monthRange(new Date(at("2026-10-19", "12:00")))).toEqual({
      from: new Date("2026-10-01T00:00:00.000Z"),
      to: new Date("2026-11-01T00:00:00.000Z"),
    });
  });

  it("fills the register tiles", () => {
    const tiles = registerTiles(
      [
        appt({ status: "COMPLETED", actualHours: 2.5, date: "2026-10-19", start: "07:00", end: "09:00" }),
        appt({ status: "COMPLETED", actualHours: 4, date: "2026-09-30" }),
        appt({ date: "2026-10-21" }),
        appt({ status: "CANCELLED", date: "2026-10-22" }),
        appt({ date: "2026-10-30" }),
      ],
      now,
    );
    expect(tiles).toEqual({ thisWeek: 2, upcoming: 2, hoursThisMonth: 2.5 });
  });
});

describe("numbering", () => {
  it("starts each year at 001", () => {
    expect(nextAppointmentNumber([], 2026)).toBe("SCH-2026-001");
    expect(nextAppointmentNumber(["SCH-2025-014"], 2026)).toBe("SCH-2026-001");
  });

  it("follows the highest number used this year, deleted ones included", () => {
    expect(nextAppointmentNumber(["SCH-2026-001", "SCH-2026-007", "SCH-2026-003"], 2026)).toBe("SCH-2026-008");
    expect(nextAppointmentNumber(["GD-2026-050", "SCH-2026-002"], 2026)).toBe("SCH-2026-003");
    expect(nextAppointmentNumber(["SCH-2026-999"], 2026)).toBe("SCH-2026-1000");
  });
});

describe("what may happen next", () => {
  it("deletes only a scheduled visit with nothing on a timesheet", () => {
    expect(canDelete({ status: "SCHEDULED", timeLoggedAt: null })).toBe(true);
    expect(canDelete({ status: "SCHEDULED", timeLoggedAt: "2026-10-19T00:00:00.000Z" })).toBe(false);
    expect(canDelete({ status: "COMPLETED", timeLoggedAt: null })).toBe(false);
    expect(canDelete({ status: "POSTPONED", timeLoggedAt: null })).toBe(false);
  });

  it("says why hours cannot go on the timesheets", () => {
    expect(timesheetBlocker({ projectId: "p1", timeLoggedAt: null, attendeeIds: ["u1"] })).toBeNull();
    expect(timesheetBlocker({ projectId: null, timeLoggedAt: null, attendeeIds: ["u1"] })).toMatch(/project/);
    expect(timesheetBlocker({ projectId: "p1", timeLoggedAt: "x", attendeeIds: ["u1"] })).toMatch(/already/);
    expect(timesheetBlocker({ projectId: "p1", timeLoggedAt: null, attendeeIds: [] })).toMatch(/Nobody/);
  });

  it("lets an administrator log for everyone and anyone else only for themselves", () => {
    const people = [
      { id: "u1", name: "Ana" },
      { id: "u2", name: "Bas" },
    ];
    expect(timesheetTargets(people, { id: "u1", isApprover: true })).toEqual({ log: people, skipped: [] });
    expect(timesheetTargets(people, { id: "u1", isApprover: false })).toEqual({
      log: [people[0]],
      skipped: [people[1]],
    });
    expect(timesheetTargets(people, { id: "u9", isApprover: false })).toEqual({ log: [], skipped: people });
  });
});
