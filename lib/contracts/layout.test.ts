import { describe, expect, it } from "vitest";
import {
  MAX_BLOCK_CHARS,
  chunkParagraph,
  clauseTitle,
  emphasise,
  isBlankValue,
  labelledItems,
  pairCards,
  paragraphShape,
  stripEmphasis,
  tableColumns,
} from "./layout";

const bolded = (text: string, names: string[] = []) =>
  emphasise(text, names)
    .filter((s) => s.bold)
    .map((s) => s.text);

describe("emphasis honours the model first", () => {
  it("sets the model's own spans bold and drops the markers", () => {
    const spans = emphasise("The sum is **AWG 1,275,000.00** in total.");
    expect(spans.map((s) => s.text).join("")).toBe("The sum is AWG 1,275,000.00 in total.");
    expect(bolded("The sum is **AWG 1,275,000.00** in total.")).toEqual(["AWG 1,275,000.00"]);
  });

  it("does not run patterns inside an already-bold span", () => {
    const spans = emphasise("**Lot 5 at AWG 100,000** stands.");
    expect(spans.filter((s) => s.bold)).toHaveLength(1);
  });
});

describe("the patterns", () => {
  it("finds money in the currencies these contracts use", () => {
    expect(bolded("Pay AWG 350,000 and US$ 200,000 and Afl. 12.50")).toEqual([
      "AWG 350,000",
      "US$ 200,000",
      "Afl. 12.50",
    ]);
  });

  it("finds areas, percentages and lots", () => {
    expect(bolded("A plot of 1,250 m² at 40% covering Lot 5A")).toEqual(["1,250 m²", "40%", "Lot 5A"]);
  });

  it("does not bold a bare number that merely follows a word", () => {
    expect(bolded("clause 5 of the agreement")).toEqual([]);
  });

  it("finds dates in the three languages a template here arrives in", () => {
    expect(bolded("Dated 15 September 2026")).toEqual(["15 September 2026"]);
    expect(bolded("Gedateerd 15 september 2026")).toEqual(["15 september 2026"]);
    expect(bolded("Fechado 15 de septiembre de 2026")).toEqual(["15 de septiembre de 2026"]);
    expect(bolded("On 2026-09-15 and 15/09/2026")).toEqual(["2026-09-15", "15/09/2026"]);
  });

  it("finds the party names it was given, and ignores ones too short to be names", () => {
    expect(bolded("Between Jozef Lacle and the contractor", ["Jozef Lacle", "AB"])).toEqual([
      "Jozef Lacle",
    ]);
  });

  it("never overlaps two hits", () => {
    const spans = emphasise("40% of AWG 350,000 payable");
    const text = spans.map((s) => s.text).join("");
    expect(text).toBe("40% of AWG 350,000 payable");
    expect(spans.filter((s) => s.bold).map((s) => s.text)).toEqual(["40%", "AWG 350,000"]);
  });

  it("conserves every character of the paragraph", () => {
    const source = "Pay **AWG 350,000** by 15 September 2026 — 40% of the sum, Lot 7.";
    expect(emphasise(source).map((s) => s.text).join("")).toBe(source.replace(/\*\*/g, ""));
  });

  it("strips markers where bold would be noise", () => {
    expect(stripEmphasis("**ARTICLE 11** — Entire Agreement")).toBe("ARTICLE 11 — Entire Agreement");
  });
});

describe("clause titles", () => {
  it("reads a numbered sub-clause with a short title", () => {
    const c = clauseTitle("11.1 Entire Agreement. This agreement constitutes the whole.");
    expect(c).toEqual({
      number: "11.1",
      title: "Entire Agreement",
      rest: "This agreement constitutes the whole.",
    });
  });

  it("refuses a title that is really the start of a sentence", () => {
    const c = clauseTitle(
      "11.2 The Contractor shall at its own cost provide all plant and labour. The Employer shall pay.",
    );
    expect(c?.title).toBe("");
    expect(c?.number).toBe("11.2");
  });

  it("reads a bare number with no title", () => {
    expect(clauseTitle("3. The works shall commence on site.")?.number).toBe("3");
  });

  it("returns null for ordinary prose", () => {
    expect(clauseTitle("The parties agree as follows.")).toBeNull();
  });
});

describe("labelled items", () => {
  it("splits on em dashes and on lines", () => {
    expect(labelledItems("Name: Acme NV — Address: Caya 12 — Phone: 588-1234")).toEqual([
      { label: "Name", value: "Acme NV" },
      { label: "Address", value: "Caya 12" },
      { label: "Phone", value: "588-1234" },
    ]);
    expect(labelledItems("Name: Acme NV\nAddress: Caya 12")).toHaveLength(2);
  });

  it("ignores pieces that are not labelled", () => {
    expect(labelledItems("Acme NV — Address: Caya 12")).toEqual([
      { label: "Address", value: "Caya 12" },
    ]);
  });
});

describe("paragraph shapes", () => {
  it("reads an execution block as a signature card, heading without a colon", () => {
    const shape = paragraphShape(
      "CONTRACTOR — Name: Acme Construction NV — Signature: __________ — Date: __________",
    );
    expect(shape.kind).toBe("card");
    if (shape.kind !== "card") throw new Error("expected a card");
    expect(shape.heading).toBe("CONTRACTOR");
    expect(shape.signature).toBe(true);
    expect(shape.items).toHaveLength(3);
  });

  it("reads a party's particulars as a card", () => {
    const shape = paragraphShape("EMPLOYER: Name: Jozef Lacle — Address: Oranjestad");
    expect(shape.kind).toBe("card");
    if (shape.kind !== "card") throw new Error("expected a card");
    expect(shape.signature).toBe(false);
  });

  it("reads a run of ordinary labels as a table, not a card", () => {
    const shape = paragraphShape("Commencement: 1 October 2026 — Completion: 1 April 2027");
    expect(shape.kind).toBe("table");
  });

  it("reads a numbered clause", () => {
    expect(paragraphShape("11.1 Entire Agreement. The whole of it.").kind).toBe("clause");
  });

  it("leaves prose alone", () => {
    expect(paragraphShape("The Contractor shall carry out the works.").kind).toBe("prose");
    expect(paragraphShape("").kind).toBe("prose");
  });
});

describe("drawing decisions", () => {
  it("treats an empty or dashed value as a fill-in line", () => {
    expect(isBlankValue("")).toBe(true);
    expect(isBlankValue("__________")).toBe(true);
    expect(isBlankValue("—")).toBe(true);
    expect(isBlankValue("Acme NV")).toBe(false);
  });

  it("pairs signature cards two to a row", () => {
    expect(pairCards(["a", "b", "c"])).toEqual([["a", "b"], ["c"]]);
    expect(pairCards([])).toEqual([]);
  });

  it("uses two columns only when the values are short", () => {
    const short = Array.from({ length: 4 }, (_, i) => ({ label: `L${i}`, value: "12 m" }));
    const long = Array.from({ length: 4 }, (_, i) => ({
      label: `L${i}`,
      value: "a value long enough that two columns would wrap badly on the sheet",
    }));
    expect(tableColumns(short)).toBe(2);
    expect(tableColumns(long)).toBe(1);
    expect(tableColumns(short.slice(0, 2))).toBe(1);
  });
});

describe("giving the paginator somewhere to cut", () => {
  const sentence =
    "The Contractor shall execute and complete the Works in accordance with the Contract Documents and to the reasonable satisfaction of the Architect. ";

  it("leaves a short paragraph alone", () => {
    expect(chunkParagraph("One short clause.")).toEqual(["One short clause."]);
  });

  it("splits a long clause into runs under the limit", () => {
    const long = sentence.repeat(9);
    const chunks = chunkParagraph(long);
    // 9 sentences of ~147 chars = ~1,320 characters, so three runs of <=550.
    expect(chunks.length).toBe(3);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(MAX_BLOCK_CHARS + sentence.length);
  });

  it("conserves every character — splitting must never lose text", () => {
    const long = sentence.repeat(9);
    expect(chunkParagraph(long).join("")).toBe(long);
  });

  it("cuts between sentences, never inside one", () => {
    const chunks = chunkParagraph(sentence.repeat(6));
    for (const c of chunks) expect(c.trim().endsWith(".")).toBe(true);
  });

  it("leaves one enormous sentence whole rather than mangling it", () => {
    const monster = `The Contractor ${"and the Employer ".repeat(80)}agree.`;
    expect(chunkParagraph(monster)).toEqual([monster]);
  });
});
