import { describe, expect, it } from "vitest";
import { PROGRESS } from "./data";
import {
  addDays,
  buildAxis,
  chipStyle,
  dayLabel,
  dayMark,
  daysBetween,
  lastDataDay,
  longDate,
  officeToday,
  overallPct,
  pctTone,
  shortCommit,
  spanBox,
  TICK_GAP,
} from "./timeline";

describe("calendar days", () => {
  it("counts whole days across a month end", () => {
    expect(daysBetween("2026-09-14", "2026-10-08")).toBe(24);
    expect(daysBetween("2026-10-08", "2026-09-14")).toBe(-24);
    expect(addDays("2026-09-28", 3)).toBe("2026-10-01");
  });

  it("labels days the way the board prints them", () => {
    expect(dayLabel("2026-10-05")).toBe("5 OCT");
    expect(longDate("2026-10-08")).toBe("08 OCT 2026");
  });

  it("takes today in the office time zone, not UTC", () => {
    // 02:30 UTC on 9 OCT is still 22:30 on 8 OCT in Aruba (UTC-4).
    const late = new Date("2026-10-09T02:30:00Z");
    expect(officeToday(late, "America/Aruba")).toBe("2026-10-08");
    expect(officeToday(late, "UTC")).toBe("2026-10-09");
  });

  it("rejects anything that is not YYYY-MM-DD", () => {
    expect(() => daysBetween("2026-9-14", "2026-10-08")).toThrow();
  });
});

describe("buildAxis", () => {
  it("runs 14 SEP → 8 OCT as 25 days with today in the middle of the last one", () => {
    const axis = buildAxis("2026-09-14", "2026-10-08", "2026-10-08");
    expect(axis.totalDays).toBe(25);
    expect(axis.todayIndex).toBe(24);
    expect(axis.todayX).toBeCloseTo(98);
    // 5 OCT (Mon) would overprint the TODAY label three days later, so it is dropped.
    expect(axis.ticks.map((t) => `${t.label} ${t.sub}`)).toEqual(["14 SEP MON", "21 SEP MON", "28 SEP MON", "8 OCT TODAY"]);
    expect(axis.ticks.at(-1)!.x).toBeCloseTo(axis.todayX!);
  });

  it("extends the axis when today is past the last day in the data", () => {
    const axis = buildAxis("2026-09-14", "2026-10-20", "2026-10-08");
    expect(axis.end).toBe("2026-10-20");
    expect(axis.totalDays).toBe(37);
    expect(axis.todayX).toBeCloseTo((36.5 / 37) * 100);
  });

  it("keeps data that runs past today on the axis", () => {
    const axis = buildAxis("2026-09-14", "2026-10-01", "2026-10-08");
    expect(axis.totalDays).toBe(25);
    expect(axis.todayIndex).toBe(17);
  });

  it("drops a regular tick that would overprint TODAY", () => {
    // 12 OCT is a Monday: it is today, so only the TODAY tick stands there.
    const monday = buildAxis("2026-09-14", "2026-10-12", null);
    expect(monday.ticks.filter((t) => t.iso === "2026-10-12")).toHaveLength(1);
    // Two days after a Monday: that Monday is dropped.
    const wed = buildAxis("2026-09-14", "2026-10-14", null);
    expect(wed.ticks.some((t) => t.iso === "2026-10-12")).toBe(false);
    expect(wed.ticks.at(-1)!.today).toBe(true);
  });

  it("keeps every regular tick clear of the TODAY label, on any axis length", () => {
    for (let n = 0; n < 200; n += 3) {
      const axis = buildAxis("2026-09-14", addDays("2026-09-14", n), null);
      const t = axis.ticks.find((k) => k.today)!;
      for (const k of axis.ticks) if (!k.today) expect(t.x - k.x).toBeGreaterThanOrEqual(TICK_GAP);
    }
  });

  it("widens the tick step on a long axis", () => {
    const axis = buildAxis("2026-09-14", "2027-01-31", null);
    const regular = axis.ticks.filter((t) => !t.today);
    expect(daysBetween(regular[0].iso, regular[1].iso)).toBe(14);
    expect(regular.length).toBeLessThanOrEqual(11);
  });

  it("has no today line before the start", () => {
    const axis = buildAxis("2026-09-14", "2026-09-01", "2026-10-08");
    expect(axis.todayX).toBeNull();
    expect(axis.ticks.some((t) => t.today)).toBe(false);
  });
});

describe("positions", () => {
  const axis = buildAxis("2026-09-14", "2026-10-08", null);

  it("puts a span at the left edge of its first day, one day = 4 % of 25", () => {
    expect(spanBox(axis, { from: "2026-09-14", days: 2 })).toEqual({ left: 0, width: 8 });
    const oct6 = spanBox(axis, { from: "2026-10-06", days: 3 })!;
    expect(oct6.left).toBeCloseTo(88);
    expect(oct6.width).toBeCloseTo(12);
  });

  it("clips spans to the axis and drops ones outside it", () => {
    expect(spanBox(axis, { from: "2026-10-08", days: 5 })).toEqual({ left: 96, width: 4 });
    expect(spanBox(axis, { from: "2026-09-01", days: 2 })).toBeNull();
    expect(spanBox(axis, { from: "2026-09-20", days: 0 })).toBeNull();
  });

  it("puts a release diamond in the middle of its day", () => {
    expect(dayMark(axis, "2026-09-15")).toBeCloseTo(6);
    expect(dayMark(axis, "2026-10-09")).toBeNull();
  });

  it("finds the last day in the data", () => {
    expect(lastDataDay([{ worked: [{ from: "2026-10-06", days: 3 }] }], ["2026-10-01"])).toBe("2026-10-08");
    expect(lastDataDay([], [])).toBeNull();
  });
});

describe("overall, tones, chips", () => {
  it("BUILT is the plain mean of the phases", () => {
    expect(overallPct(PROGRESS.phases)).toBe(89);
    expect(overallPct([{ pct: 100 }, { pct: 0 }])).toBe(50);
    expect(overallPct([])).toBe(0);
    expect(overallPct([{ pct: 140 }, { pct: -5 }])).toBe(50);
  });

  it("colours a phase cyan ≥ 80, amber ≥ 50, red below", () => {
    expect(pctTone(100)).toBe("ok");
    expect(pctTone(80)).toBe("ok");
    expect(pctTone(79)).toBe("amber");
    expect(pctTone(50)).toBe("amber");
    expect(pctTone(15)).toBe("red");
  });

  it("classifies NEXT chips", () => {
    expect(chipStyle("you")).toBe("you");
    expect(chipStyle("go")).toBe("go");
    expect(chipStyle("plain")).toBe("plain");
  });

  it("shortens the deployed commit and says local off Vercel", () => {
    expect(shortCommit("1b16df1a2b3c4d")).toBe("1b16df1");
    expect(shortCommit(undefined)).toBe("local");
    expect(shortCommit("  ")).toBe("local");
  });
});

describe("the seeded data", () => {
  it("has nine phases P0–P8 with sane numbers and ISO dates", () => {
    expect(PROGRESS.phases.map((p) => p.code)).toEqual(["P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"]);
    for (const p of PROGRESS.phases) {
      expect(p.pct).toBeGreaterThanOrEqual(0);
      expect(p.pct).toBeLessThanOrEqual(100);
      for (const w of p.worked) {
        expect(daysBetween(PROGRESS.start, w.from)).toBeGreaterThanOrEqual(0);
        expect(w.days).toBeGreaterThan(0);
      }
    }
    for (const r of PROGRESS.releases) expect(daysBetween(PROGRESS.start, r)).toBeGreaterThanOrEqual(0);
    expect(daysBetween(PROGRESS.asOf, lastDataDay(PROGRESS.phases, PROGRESS.releases)!)).toBeLessThanOrEqual(0);
  });
});
