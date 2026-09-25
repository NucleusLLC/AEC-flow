import { describe, expect, it } from "vitest";
import { hasContent, markedSpans, stripMarkers } from "./emphasis";

const plain = (text: string) => markedSpans(text).map((s) => (s.bold ? `[${s.text}]` : s.text)).join("");

describe("**bold**", () => {
  it("marks what is between the pairs and leaves the rest alone", () => {
    expect(markedSpans("Fees are **fixed** for the duration.")).toEqual([
      { text: "Fees are ", bold: false },
      { text: "fixed", bold: true },
      { text: " for the duration.", bold: false },
    ]);
  });

  it("handles several in one paragraph", () => {
    expect(plain("**A** then **B** then C")).toBe("[A] then [B] then C");
  });

  it("marks a whole field when the whole field is marked", () => {
    expect(markedSpans("**Everything**")).toEqual([{ text: "Everything", bold: true }]);
  });

  it("lets a marked phrase wrap across a line break", () => {
    expect(markedSpans("**two\nlines**")).toEqual([{ text: "two\nlines", bold: true }]);
  });

  it("keeps the text either side exactly, including its spaces", () => {
    const spans = markedSpans("a  **b**  c");
    expect(spans.map((s) => s.text)).toEqual(["a  ", "b", "  c"]);
  });
});

describe("what it deliberately does not do", () => {
  it("leaves an unclosed marker on the page rather than bolding to the end", () => {
    // A typo mid-paragraph must not turn the rest of the document bold.
    expect(markedSpans("Fees are **fixed for the duration.")).toEqual([
      { text: "Fees are **fixed for the duration.", bold: false },
    ]);
  });

  it("leaves a stray closing marker alone too", () => {
    expect(markedSpans("Fees are fixed** for the duration.")).toEqual([
      { text: "Fees are fixed** for the duration.", bold: false },
    ]);
  });

  it("treats **** as four asterisks, not an empty bold span", () => {
    expect(markedSpans("****")).toEqual([{ text: "****", bold: false }]);
  });

  it("is not markdown: other markers are literal", () => {
    expect(plain("_no_ # no [no](no) `no`")).toBe("_no_ # no [no](no) `no`");
  });

  it("does not bold a figure nobody marked", () => {
    // The contract typesetter auto-bolds money; a proposal must not, or every
    // proposal already in the system would restyle itself.
    expect(markedSpans("The fee is AWG 45,000.00 excluding BBO.")).toEqual([
      { text: "The fee is AWG 45,000.00 excluding BBO.", bold: false },
    ]);
  });

  it("returns nothing for nothing", () => {
    expect(markedSpans("")).toEqual([]);
    expect(markedSpans(null)).toEqual([]);
    expect(markedSpans(undefined)).toEqual([]);
  });
});

describe("places that cannot carry emphasis", () => {
  it("strips the markers and keeps the words", () => {
    expect(stripMarkers("Fees are **fixed** for the duration.")).toBe(
      "Fees are fixed for the duration.",
    );
  });

  it("leaves an unclosed marker as typed, the same way", () => {
    expect(stripMarkers("Fees are **fixed")).toBe("Fees are **fixed");
  });

  it("copes with null", () => {
    expect(stripMarkers(null)).toBe("");
  });
});

describe("hasContent", () => {
  it("is false for whitespace, true for words", () => {
    expect(hasContent(markedSpans("   \n  "))).toBe(false);
    expect(hasContent(markedSpans("**x**"))).toBe(true);
  });
});
