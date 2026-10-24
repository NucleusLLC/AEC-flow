import { describe, expect, it } from "vitest";
import {
  SUBMIT_FAILED_MESSAGE,
  SUBMIT_UNREACHABLE_MESSAGE,
  PANEL_CRASHED_MESSAGE,
  submitFailureMessage,
} from "./submit-errors";

class ActorError extends Error {
  override name = "ActorError";
}

describe("submitFailureMessage", () => {
  it("passes on a sentence written for the person signed in", () => {
    expect(submitFailureMessage(new ActorError("You must be signed in."))).toBe("You must be signed in.");
  });

  it("never shows a database or driver error", () => {
    const raw = new Error(
      'Invalid `prisma.betaReport.create()` invocation: The column `beta_reports.reporterId` does not exist in the current database.',
    );
    expect(submitFailureMessage(raw)).toBe(SUBMIT_FAILED_MESSAGE);
    expect(submitFailureMessage(new TypeError("fetch failed"))).toBe(SUBMIT_FAILED_MESSAGE);
  });

  it("copes with anything that can be thrown", () => {
    for (const thrown of [null, undefined, "boom", 42, {}, new ActorError("  ")]) {
      expect(submitFailureMessage(thrown)).toBe(SUBMIT_FAILED_MESSAGE);
    }
  });

  it("keeps the three messages distinct and free of technical words", () => {
    const all = [SUBMIT_FAILED_MESSAGE, SUBMIT_UNREACHABLE_MESSAGE, PANEL_CRASHED_MESSAGE];
    expect(new Set(all).size).toBe(3);
    for (const m of all) expect(m).not.toMatch(/prisma|sql|exception|undefined|stack|node/i);
  });
});
