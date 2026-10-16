import { describe, expect, it } from "vitest";
import { calibrationFromImperial, calibrationFromRatio, parseScaleNote, pt2ToM2, ptToMm } from "./scale";

describe("drawing scale notes", () => {
  it.each([["1:100", 100], ["SCALE 1 : 50", 50]])("reads %s", (note, denominator) => {
    expect(parseScaleNote(note)?.mmPerPoint).toBe((25.4 / 72) * denominator);
  });
  it.each([['1/4" = 1\'-0"', 1 / 4], ['1/8"=1\'', 1 / 8], ['3/16" = 1\'-0"', 3 / 16]])("reads %s", (note, inches) => {
    expect(parseScaleNote(note)?.mmPerPoint).toBeCloseTo(304.8 / (72 * inches));
  });
  it.each(["NTS", "NOT TO SCALE", "garbage", "", "1:0", "1:-50", '1/0"=1\'', '0"=1\'', '1/4"=0\'', "1:100 garbage", '1/4"=1\'-6"'])("rejects %s", (note) => {
    expect(parseScaleNote(note)).toBeNull();
  });
  it("rejects nonpositive and nonfinite inputs", () => {
    const calibration = calibrationFromRatio(100)!;
    for (const value of [0, -1, Infinity, NaN]) {
      expect(calibrationFromRatio(value)).toBeNull();
      expect(calibrationFromImperial(value, 1)).toBeNull();
      expect(calibrationFromImperial(1, value)).toBeNull();
      expect(ptToMm(1, { mmPerPoint: value, reference: "bad" })).toBeNull();
    }
    for (const value of [-1, Infinity, NaN]) {
      expect(ptToMm(value, calibration)).toBeNull();
      expect(pt2ToM2(value, calibration)).toBeNull();
    }
    // A zero-length line is a real measurement of nothing, not a missing scale.
    expect(ptToMm(0, calibration)).toBe(0);
    expect(pt2ToM2(0, calibration)).toBe(0);
  });
  it("converts a paper inch to 2.54 real metres at 1:100", () => {
    const calibration = calibrationFromRatio(100)!;
    expect(ptToMm(72, calibration)).toBeCloseTo(2540);
    expect(pt2ToM2(72 * 72, calibration)).toBeCloseTo(2.54 ** 2);
  });
});
