import { describe, expect, it } from "vitest";
import { dayDiff, leadDays, revisionReminder, type RevisionReminderInput } from "./revision-reminder";

const base: RevisionReminderInput = {
  status: "INFO_REQUESTED",
  revisionDueAt: "2026-10-15",
  revisionReminderDays: 7,
  revisionSetAt: "2026-09-28T10:00:00.000Z",
  latestSubmissionRecordedAt: "2026-09-01T09:00:00.000Z",
};

describe("revisionReminder", () => {
  it("stays quiet with no deadline", () => {
    expect(revisionReminder({ ...base, revisionDueAt: null }, "2026-10-14")).toBeNull();
  });

  it("stays quiet until a week before the deadline", () => {
    expect(revisionReminder(base, "2026-10-07")).toBeNull();
  });

  it("starts exactly one week before", () => {
    expect(revisionReminder(base, "2026-10-08")).toEqual({ state: "upcoming", daysLeft: 7 });
  });

  it("says due today on the day", () => {
    expect(revisionReminder(base, "2026-10-15")).toEqual({ state: "today", daysLeft: 0 });
  });

  it("keeps going, as overdue, after the deadline", () => {
    expect(revisionReminder(base, "2026-10-18")).toEqual({ state: "overdue", daysLeft: -3 });
  });

  it("honours a different warning period", () => {
    expect(revisionReminder({ ...base, revisionReminderDays: 14 }, "2026-10-01")).toEqual({
      state: "upcoming",
      daysLeft: 14,
    });
    expect(revisionReminder({ ...base, revisionReminderDays: 2 }, "2026-10-12")).toBeNull();
  });

  it("stops once a new version is recorded after the reminder was set", () => {
    const answered = { ...base, latestSubmissionRecordedAt: "2026-10-10T12:00:00.000Z" };
    expect(revisionReminder(answered, "2026-10-12")).toBeNull();
  });

  it("is not stopped by a version recorded before the reminder was set", () => {
    expect(revisionReminder(base, "2026-10-12")?.state).toBe("upcoming");
  });

  it("stops on a closed file", () => {
    for (const status of ["APPROVED", "ISSUED", "REJECTED", "WITHDRAWN", "EXPIRED"] as const) {
      expect(revisionReminder({ ...base, status }, "2026-10-14")).toBeNull();
    }
  });
});

describe("helpers", () => {
  it("counts whole days across a month end", () => {
    expect(dayDiff("2026-09-28", "2026-10-05")).toBe(7);
  });

  it("falls back to a week for an unreadable warning period", () => {
    expect(leadDays(undefined)).toBe(7);
    expect(leadDays(-3)).toBe(7);
    expect(leadDays(500)).toBe(90);
  });
});
