import { describe, expect, it } from "vitest";
import {
  LETTER_PDF_MAX_BYTES,
  buildDocumentKey,
  buildLetterKey,
  isDocumentKeyForPermit,
  isLetterKeyForPermit,
  validateLetterPdf,
  validatePermitFile,
} from "./letter-file";

describe("validateLetterPdf", () => {
  it("accepts a PDF", () => {
    expect(validateLetterPdf({ name: "DOW letter.pdf", size: 1200, type: "application/pdf" })).toEqual({
      ok: true,
    });
  });

  it("accepts a .pdf whose browser reported no type", () => {
    expect(validateLetterPdf({ name: "scan.PDF", size: 1200, type: "" }).ok).toBe(true);
  });

  it("refuses anything that is not a PDF", () => {
    expect(validateLetterPdf({ name: "letter.docx", size: 1200, type: "" }).ok).toBe(false);
    expect(validateLetterPdf({ name: "letter.pdf", size: 1200, type: "image/png" }).ok).toBe(false);
  });

  it("refuses an empty file and one over the ceiling", () => {
    expect(validateLetterPdf({ name: "a.pdf", size: 0, type: "application/pdf" }).ok).toBe(false);
    expect(
      validateLetterPdf({ name: "a.pdf", size: LETTER_PDF_MAX_BYTES + 1, type: "application/pdf" }).ok,
    ).toBe(false);
  });
});

describe("letter storage keys", () => {
  it("builds a permit- and upload-scoped key with a safe filename", () => {
    expect(buildLetterKey("perm1", "DOW reply (final).pdf", "u-1")).toBe(
      "permits/perm1/letters/u-1/DOW-reply-final.pdf",
    );
  });

  it("recognises its own keys", () => {
    expect(isLetterKeyForPermit(buildLetterKey("perm1", "a.pdf", "u-1"), "perm1")).toBe(true);
  });

  it("refuses another permit's key, traversal and nesting", () => {
    const key = buildLetterKey("perm1", "a.pdf", "u-1");
    expect(isLetterKeyForPermit(key, "perm2")).toBe(false);
    expect(isLetterKeyForPermit("permits/perm1/letters/../../perm2/letters/u/a.pdf", "perm1")).toBe(false);
    expect(isLetterKeyForPermit("permits/perm1/letters/u-1/x/a.pdf", "perm1")).toBe(false);
    expect(isLetterKeyForPermit("projects/p/drawings/u-1/a.pdf", "perm1")).toBe(false);
  });
});

describe("validatePermitFile", () => {
  it("takes the file types a case file actually collects", () => {
    for (const name of ["form.pdf", "site.JPG", "extract.dwg", "fees.xlsx", "notice.png"]) {
      expect(validatePermitFile({ name, size: 2048, type: "" }).ok).toBe(true);
    }
  });

  it("refuses what it cannot be trusted to hold", () => {
    const bad = validatePermitFile({ name: "payload.exe", size: 2048, type: "" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toContain("not a file type");
    expect(validatePermitFile({ name: "noextension", size: 10, type: "" }).ok).toBe(false);
  });

  it("refuses an empty file and one over the 25 MB ceiling", () => {
    expect(validatePermitFile({ name: "a.pdf", size: 0, type: "" }).ok).toBe(false);
    expect(validatePermitFile({ name: "a.pdf", size: LETTER_PDF_MAX_BYTES + 1, type: "" }).ok).toBe(false);
  });
});

describe("document keys are separate from letter keys", () => {
  it("issues and recognises its own", () => {
    const key = buildDocumentKey("perm1", "Stamped form.pdf", "u-9");
    expect(key).toBe("permits/perm1/documents/u-9/Stamped-form.pdf");
    expect(isDocumentKeyForPermit(key, "perm1")).toBe(true);
  });

  it("does not accept a letter key as a document key, or the reverse", () => {
    const letter = buildLetterKey("perm1", "a.pdf", "u-1");
    const document = buildDocumentKey("perm1", "a.pdf", "u-1");
    expect(isDocumentKeyForPermit(letter, "perm1")).toBe(false);
    expect(isLetterKeyForPermit(document, "perm1")).toBe(false);
  });

  it("refuses an empty permit id rather than matching every key", () => {
    expect(isDocumentKeyForPermit("permits//documents/u-1/a.pdf", "")).toBe(false);
    expect(isLetterKeyForPermit("permits//letters/u-1/a.pdf", "")).toBe(false);
  });
});
