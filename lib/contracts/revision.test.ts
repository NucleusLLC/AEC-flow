import { describe, expect, it } from "vitest";
import {
  baseNumber,
  compareLetters,
  diffContracts,
  diffSummary,
  nextLetter,
  nextRevisionNumber,
  revisionLabel,
  revisionLetter,
  sortFamily,
} from "./revision";
import { EMPTY_BODY, EMPTY_FACTS, type ContractArticle, type ContractBody, type ContractFacts } from "./types";

const facts = (over: Partial<ContractFacts> = {}): ContractFacts => ({
  ...EMPTY_FACTS,
  projectName: "Kamay 33",
  employerName: "R. Croes",
  contractorName: "Bouwbedrijf Aruba N.V.",
  currency: "AWG",
  contractSum: 850_000,
  ...over,
});

const art = (number: string, heading: string, ...paragraphs: string[]): ContractArticle => ({
  number,
  heading,
  paragraphs,
});

const body = (articles: ContractArticle[], over: Partial<ContractBody> = {}): ContractBody => ({
  ...EMPTY_BODY,
  title: "Construction Contract",
  articles,
  ...over,
});

describe("revision numbering", () => {
  it("keeps the contract's number and adds a letter", () => {
    expect(nextRevisionNumber("CC-2026-004", ["CC-2026-004"])).toBe("CC-2026-004 Rev B");
    expect(baseNumber("CC-2026-004 Rev C")).toBe("CC-2026-004");
  });

  it("calls the first issue the original, not Rev A", () => {
    expect(revisionLetter("CC-2026-004")).toBeNull();
    expect(revisionLabel("CC-2026-004")).toBe("Original issue");
    expect(revisionLabel("CC-2026-004 Rev B")).toBe("Rev B");
  });

  it("does not mint a letter that already exists when an older version is revised", () => {
    // Someone opens Rev B and revises it while Rev C is already out.
    const held = ["CC-2026-004", "CC-2026-004 Rev B", "CC-2026-004 Rev C"];
    expect(nextRevisionNumber("CC-2026-004 Rev B", held)).toBe("CC-2026-004 Rev D");
  });

  it("does not look at other contracts' letters", () => {
    const held = ["CC-2026-004", "CC-2026-009 Rev F"];
    expect(nextRevisionNumber("CC-2026-004", held)).toBe("CC-2026-004 Rev B");
  });

  it("carries past Z", () => {
    expect(nextLetter("Y")).toBe("Z");
    expect(nextLetter("Z")).toBe("AA");
    expect(nextLetter("AZ")).toBe("BA");
    expect(nextLetter("ZZ")).toBe("AAA");
    expect(compareLetters("Z", "AA")).toBeLessThan(0);
  });

  it("orders a family with the original first", () => {
    const rows = [{ number: "CC-1 Rev C" }, { number: "CC-1" }, { number: "CC-1 Rev B" }];
    expect(sortFamily(rows).map((r) => r.number)).toEqual(["CC-1", "CC-1 Rev B", "CC-1 Rev C"]);
  });
});

describe("what changed", () => {
  it("puts the contract sum first, because that is what is being looked for", () => {
    const d = diffContracts(
      { facts: facts({ siteAddress: "Kamay 33" }), body: body([]) },
      { facts: facts({ contractSum: 910_000, siteAddress: "Kamay 33a" }), body: body([]) },
    );
    expect(d.facts[0].label).toBe("Contract sum");
    expect(d.facts[0].from).toBe("AWG 850,000.00");
    expect(d.facts[0].to).toBe("AWG 910,000.00");
    expect(d.facts.map((f) => f.label)).toContain("Site");
  });

  it("reports an inserted clause once, not as thirty rewrites", () => {
    const before = body([
      art("1", "Definitions", "In this contract…"),
      art("2", "The Works", "The contractor shall…"),
      art("3", "Payment", "The employer shall pay…"),
    ]);
    const after = body([
      art("1", "Definitions", "In this contract…"),
      art("2", "Health and Safety", "The contractor shall comply…"),
      art("3", "The Works", "The contractor shall…"),
      art("4", "Payment", "The employer shall pay…"),
    ]);

    const d = diffContracts({ facts: facts(), body: before }, { facts: facts(), body: after });
    expect(d.articles.filter((c) => c.kind === "added")).toHaveLength(1);
    expect(d.articles.filter((c) => c.kind === "reworded")).toHaveLength(0);
    expect(d.articles.filter((c) => c.kind === "renumbered")).toHaveLength(2);
    expect(d.unchanged).toBe(1); // Definitions kept both its number and its words
  });

  it("finds the one sentence that moved in a long contract", () => {
    const clauses = Array.from({ length: 30 }, (_, i) =>
      art(String(i + 1), `Clause ${i + 1}`, `The parties agree to term ${i + 1}.`),
    );
    const after = clauses.map((c, i) =>
      i === 17 ? art(c.number, c.heading, "The parties agree to term 18, as amended.") : c,
    );

    const d = diffContracts({ facts: facts(), body: body(clauses) }, { facts: facts(), body: body(after) });
    expect(d.articles).toHaveLength(1);
    expect(d.articles[0]).toMatchObject({ kind: "reworded", number: "18", heading: "Clause 18" });
    expect(d.unchanged).toBe(29);
    expect(diffSummary(d)).toBe("1 clause reworded.");
  });

  it("reports a rewritten and renumbered clause as one change, not two", () => {
    const d = diffContracts(
      { facts: facts(), body: body([art("1", "A", "x"), art("12", "Insurance", "Cover shall be 1m.")]) },
      { facts: facts(), body: body([art("1", "A", "x"), art("13", "Insurance", "Cover shall be 2m.")]) },
    );
    expect(d.articles).toHaveLength(1);
    expect(d.articles[0]).toMatchObject({ kind: "reworded", number: "13", renumberedFrom: "12" });
  });

  it("falls back to the number when a heading is not unique", () => {
    const before = body([art("1", "General", "first"), art("2", "General", "second")]);
    const after = body([art("1", "General", "first"), art("2", "General", "second, amended")]);
    const d = diffContracts({ facts: facts(), body: before }, { facts: facts(), body: after });
    expect(d.articles).toHaveLength(1);
    expect(d.articles[0]).toMatchObject({ kind: "reworded", number: "2" });
  });

  it("notices a removed clause", () => {
    const d = diffContracts(
      { facts: facts(), body: body([art("1", "A", "x"), art("2", "Arbitration", "Disputes…")]) },
      { facts: facts(), body: body([art("1", "A", "x")]) },
    );
    expect(d.articles).toEqual([{ kind: "removed", number: "2", heading: "Arbitration" }]);
  });

  it("treats reflowed whitespace as no change at all", () => {
    const d = diffContracts(
      { facts: facts(), body: body([art("1", "A", "The  contractor\nshall  comply.")]) },
      { facts: facts(), body: body([art("1", "A", "The contractor shall comply.")]) },
    );
    expect(d.identical).toBe(true);
    expect(diffSummary(d)).toBe("Nothing changed.");
  });

  it("reports schedule movements in the contract's own currency", () => {
    const before = body([], {
      schedule: [
        { phase: "1", description: "On signing", detail: "", percent: 30, amountAwg: 255_000, amountUsd: 145_714.29 },
        { phase: "2", description: "On completion", detail: "", percent: 70, amountAwg: 595_000, amountUsd: 340_000 },
      ],
    });
    const after = body([], {
      schedule: [
        { phase: "1", description: "On signing", detail: "within 7 days", percent: 25, amountAwg: 212_500, amountUsd: 121_428.57 },
        { phase: "2", description: "On completion", detail: "", percent: 75, amountAwg: 637_500, amountUsd: 364_285.71 },
      ],
    });
    const d = diffContracts({ facts: facts(), body: before }, { facts: facts(), body: after });
    expect(d.schedule.map((s) => s.label)).toEqual([
      "Instalment 1 — due",
      "Instalment 1 — amount",
      "Instalment 2 — amount",
    ]);
    expect(d.schedule[1].to).toBe("25% · AWG 212,500.00");
  });

  it("summarises a mixed revision in one line", () => {
    const d = diffContracts(
      { facts: facts(), body: body([art("1", "A", "x"), art("2", "B", "y")]) },
      { facts: facts({ contractSum: 900_000 }), body: body([art("1", "A", "x2"), art("2", "C", "z")]) },
    );
    expect(diffSummary(d)).toBe("1 particular, 2 clauses reworded.");
  });
});
