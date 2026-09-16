import { describe, expect, it } from "vitest";
import { CATALOGUE, catalogueByCategory, catalogueEntry, docTypeLabel } from "./catalogue";
import {
  BLANK,
  compose,
  fillTokens,
  nextDocumentNumber,
  renderBody,
  renderSignatures,
  renderTitle,
  requiredMissing,
  unknownTokens,
} from "./render";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABEL } from "./types";

const CONTEXT = {
  firmName: "ZenArch Consultants",
  clientName: "Villa Sabana N.V.",
  projectName: "Villa Sabana",
  projectAddress: "Sabana Liber 12",
  counterpartyName: "DOW / Public Works",
  contactName: "Mr Croes",
  issueDate: "16 SEP 2026",
  effectiveDate: "20 SEP 2026",
  expiryDate: "20 MAR 2027",
  reference: "RFI-014",
  number: "GD-2026-001",
};

describe("the catalogue itself", () => {
  it("offers the documents a practice actually asks for", () => {
    const keys = CATALOGUE.map((e) => e.key);
    for (const expected of ["poa", "loi", "nda_mutual", "nda_oneway", "rfi", "rfq", "rfp"]) {
      expect(keys, expected).toContain(expected);
    }
    expect(CATALOGUE.length).toBeGreaterThanOrEqual(25);
  });

  it("has no duplicate keys — a stored document points at one of these forever", () => {
    const keys = CATALOGUE.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every entry a category the UI knows, a summary and a body", () => {
    for (const entry of CATALOGUE) {
      expect(DOCUMENT_CATEGORIES, entry.key).toContain(entry.category);
      expect(entry.summary.length, entry.key).toBeGreaterThan(10);
      expect(entry.body.length, entry.key).toBeGreaterThan(0);
      expect(entry.signatures.length, entry.key).toBeGreaterThan(0);
      expect(entry.titleTemplate.trim(), entry.key).not.toBe("");
    }
  });

  it("gives every field a key, a label and a control the composer can render", () => {
    for (const entry of CATALOGUE) {
      const keys = entry.fields.map((f) => f.key);
      expect(new Set(keys).size, entry.key).toBe(keys.length);
      for (const field of entry.fields) {
        expect(field.key, `${entry.key}.${field.key}`).toMatch(/^[a-z][A-Za-z0-9]*$/);
        expect(field.label.trim(), `${entry.key}.${field.key}`).not.toBe("");
        expect(
          ["text", "textarea", "date", "number", "money", "select"],
          `${entry.key}.${field.key}`,
        ).toContain(field.type);
        if (field.type === "select") {
          expect(field.options?.length, `${entry.key}.${field.key}`).toBeGreaterThan(1);
        }
      }
    }
  });

  it("uses no token it cannot fill — the typo tripwire", () => {
    for (const entry of CATALOGUE) {
      expect(unknownTokens(entry), `${entry.key} refers to tokens nothing can fill`).toEqual([]);
    }
  });

  it("groups by category for the picker, and every category is labelled", () => {
    const groups = catalogueByCategory();
    expect(groups.length).toBeGreaterThan(1);
    for (const group of groups) {
      expect(DOCUMENT_CATEGORY_LABEL[group.category]).toBeTruthy();
      expect(group.entries.length).toBeGreaterThan(0);
    }
    // Every entry appears exactly once across the groups.
    expect(groups.reduce((n, g) => n + g.entries.length, 0)).toBe(CATALOGUE.length);
  });

  it("looks an entry up, and survives a key it does not know", () => {
    expect(catalogueEntry("poa")?.label).toBe("Power of Attorney");
    expect(catalogueEntry("no_such_type")).toBeNull();
    expect(docTypeLabel("poa")).toBe("Power of Attorney");
    // A register still reads if a type is ever retired.
    expect(docTypeLabel("retired_type")).toBe("retired_type");
  });
});

describe("fillTokens", () => {
  it("fills from the context and from the field values, values winning", () => {
    expect(fillTokens("{{clientName}} of {{projectName}}", CONTEXT)).toBe(
      "Villa Sabana N.V. of Villa Sabana",
    );
    expect(fillTokens("{{clientName}}", CONTEXT, { clientName: "Sabana Holdings Ltd" })).toBe(
      "Sabana Holdings Ltd",
    );
  });

  it("prints a rule for anything unfilled, rather than dropping the sentence", () => {
    expect(fillTokens("until {{expiryDate}}", { firmName: "X" })).toBe(`until ${BLANK}`);
    expect(fillTokens("{{ spaced }}", {}, { spaced: "ok" })).toBe("ok");
  });

  it("ignores whitespace-only values, which is what an empty input gives back", () => {
    expect(fillTokens("{{scope}}", CONTEXT, { scope: "   " })).toBe(BLANK);
  });
});

describe("renderBody", () => {
  const entry = catalogueEntry("poa")!;

  it("fills a real template end to end", () => {
    const body = renderBody(entry.body, CONTEXT, {
      principalName: "J. Lacle",
      principalId: "AW-123456",
      attorneyName: "ZenArch Consultants",
      scope: "Submit and collect the building permit application.",
      limitations: "No sale or mortgage of the property.",
      place: "Oranjestad, Aruba",
    });
    expect(body[0]).toContain("J. Lacle (AW-123456)");
    expect(body[0]).toContain("Villa Sabana");
    expect(body.at(-1)).toBe("Signed at Oranjestad, Aruba on 16 SEP 2026.");
    expect(body.join(" ")).not.toContain("{{");
  });

  it("keeps the line breaks a writer typed into a textarea", () => {
    const body = renderBody(["{{defects}}"], {}, { defects: "Crack in the slab\nStained ceiling" });
    expect(body).toEqual(["Crack in the slab", "Stained ceiling"]);
  });

  it("drops a paragraph that would print as nothing but a rule", () => {
    expect(renderBody(["{{missing}}", "Kept."], {})).toEqual(["Kept."]);
  });

  it("still prints a labelled blank, because that is a question the reader can answer", () => {
    expect(renderBody(["Background: {{background}}"], {})).toEqual([`Background: ${BLANK}`]);
  });
});

describe("renderTitle", () => {
  it("uses the entry's template", () => {
    expect(renderTitle(catalogueEntry("poa")!, CONTEXT)).toBe("Power of Attorney — Villa Sabana N.V.");
    expect(renderTitle(catalogueEntry("rfi")!, CONTEXT)).toBe("RFI RFI-014 — Villa Sabana");
  });

  it("does not put a rule or a dangling dash in a heading", () => {
    const title = renderTitle(catalogueEntry("rfi")!, { projectName: "Casa Palm" });
    expect(title).not.toContain(BLANK);
    expect(title).toBe("RFI — Casa Palm");
  });

  it("falls back to the document's own name when nothing is known", () => {
    expect(renderTitle(catalogueEntry("cover_letter")!, {})).toBe("Cover Letter");
  });
});

describe("renderSignatures", () => {
  it("names the parties it knows and leaves the rest to be signed", () => {
    const blocks = renderSignatures(catalogueEntry("nda_mutual")!, CONTEXT);
    expect(blocks[0]).toEqual({ role: "For ZenArch Consultants", name: "ZenArch Consultants", witness: false });
    expect(blocks[1].name).toBe("DOW / Public Works");
  });

  it("marks a witness block, which the sheet prints wider", () => {
    const blocks = renderSignatures(catalogueEntry("poa")!, CONTEXT);
    expect(blocks.some((b) => b.witness)).toBe(true);
  });
});

describe("requiredMissing", () => {
  it("names the required fields that are still empty", () => {
    const entry = catalogueEntry("rfq")!;
    const missing = requiredMissing(entry, { scope: "Tiling" });
    expect(missing.map((f) => f.key)).toEqual(["quoteBy"]);
  });

  it("is empty when the required fields are filled", () => {
    expect(requiredMissing(catalogueEntry("rfq")!, { scope: "Tiling", quoteBy: "2026-10-01" })).toEqual([]);
  });
});

describe("compose", () => {
  it("returns the entry, the title, the body and what is still missing", () => {
    const out = compose("rfi", CONTEXT, { question: "Which lintel detail applies at grid C?" });
    expect(out?.title).toBe("RFI RFI-014 — Villa Sabana");
    expect(out?.body.join(" ")).toContain("Which lintel detail applies at grid C?");
    expect(out?.missing.map((f) => f.key)).toEqual(["answerBy"]);
  });

  it("is null for a type that does not exist", () => {
    expect(compose("not_a_type", CONTEXT)).toBeNull();
  });
});

describe("nextDocumentNumber", () => {
  it("starts at 001 and continues past the highest ever used", () => {
    expect(nextDocumentNumber([], 2026)).toBe("GD-2026-001");
    expect(nextDocumentNumber(["GD-2026-001", "GD-2025-030"], 2026)).toBe("GD-2026-031");
  });
});
