import { describe, expect, it } from "vitest";
import { SYNOPSIS_SYSTEM, buildSynopsisPrompt, parseSynopsis } from "./synopsis";

describe("buildSynopsisPrompt", () => {
  it("keeps the system prompt fixed, so it caches", () => {
    expect(buildSynopsisPrompt("A", "en").system).toBe(buildSynopsisPrompt("B", "ja").system);
    expect(SYNOPSIS_SYSTEM).toContain("16 SEP 2026");
  });

  it("names the language and wraps the file", () => {
    const { user } = buildSynopsisPrompt("FILE: BP-1", "nl");
    expect(user).toContain("in Dutch");
    expect(user).toContain("<file>\nFILE: BP-1\n</file>");
  });
});

describe("parseSynopsis", () => {
  it("reads a well-formed SITREP", () => {
    const s = parseSynopsis(
      JSON.stringify({ bluf: "Awaiting DOW.", situation: ["a"], actions: ["b"], risks: [] }),
    );
    expect(s).toEqual({ bluf: "Awaiting DOW.", situation: ["a"], actions: ["b"], risks: [] });
  });

  it("strips numbering the model added, since the page numbers the points", () => {
    const s = parseSynopsis(JSON.stringify({ bluf: "x", situation: ["1. First", "- Second"], actions: [], risks: [] }));
    expect(s?.situation).toEqual(["First", "Second"]);
  });

  it("refuses anything without a bottom line", () => {
    expect(parseSynopsis("not json")).toBeNull();
    expect(parseSynopsis(JSON.stringify({ situation: ["a"] }))).toBeNull();
  });
});
