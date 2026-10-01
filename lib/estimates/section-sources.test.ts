import { describe, expect, it } from "vitest";
import { filterSources, sortSources, type SectionSource } from "./section-sources";

function row(over: Partial<SectionSource>): SectionSource {
  return {
    id: over.id ?? "x",
    projectNumber: "",
    projectName: "Project",
    client: "",
    version: "V1.0",
    date: "2026-09-01",
    currency: "AWG",
    status: "draft",
    locked: false,
    sectionCount: 1,
    lineCount: 1,
    amount: 0,
    ...over,
  };
}

describe("filterSources", () => {
  const rows = [
    row({ id: "a", projectNumber: "2026A-019", projectName: "Kamay 33", client: "Koutny" }),
    row({ id: "b", projectNumber: "2026A-024", projectName: "Villa Noord", client: "Karel Koutny" }),
    row({ id: "c", projectNumber: "", projectName: "Warehouse draft", client: "" }),
  ];

  it("returns everything for an empty or blank query", () => {
    expect(filterSources(rows, "").map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(filterSources(rows, "   ").map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("matches the Job Order number, the name and the client, case-insensitively", () => {
    expect(filterSources(rows, "2026a-019").map((r) => r.id)).toEqual(["a"]);
    expect(filterSources(rows, "NOORD").map((r) => r.id)).toEqual(["b"]);
    expect(filterSources(rows, "koutny").map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("needs every word, wherever each one is found", () => {
    expect(filterSources(rows, "kamay 2026A").map((r) => r.id)).toEqual(["a"]);
    expect(filterSources(rows, "kamay noord")).toEqual([]);
  });
});

describe("sortSources", () => {
  it("puts the newest Job Order first, with numeric order inside the number", () => {
    const sorted = sortSources([
      row({ id: "019", projectNumber: "2026A-019" }),
      row({ id: "100", projectNumber: "2026A-100" }),
      row({ id: "024", projectNumber: "2026A-024" }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["100", "024", "019"]);
  });

  it("puts estimates without a Job Order number last", () => {
    const sorted = sortSources([
      row({ id: "none", projectNumber: "  " }),
      row({ id: "num", projectNumber: "2025-001" }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["num", "none"]);
  });

  it("lists one Job Order's versions newest first", () => {
    const sorted = sortSources([
      row({ id: "v1", projectNumber: "2026A-019", date: "2026-08-01" }),
      row({ id: "v2", projectNumber: "2026A-019", date: "2026-09-15" }),
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["v2", "v1"]);
  });

  it("does not mutate its input", () => {
    const input = [row({ id: "b", projectNumber: "1" }), row({ id: "a", projectNumber: "2" })];
    sortSources(input);
    expect(input.map((r) => r.id)).toEqual(["b", "a"]);
  });
});
