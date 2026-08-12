/**
 * Upload policy, title-block region selection, the PDF reader adapter, and the
 * persistence seam. Everything the intake path needs that is not the parser.
 */

import { describe, expect, it } from "vitest";
import {
  ACCEPTED_EXTENSIONS,
  createStubReader,
  DrawingPersistenceNotConfiguredError,
  createUnpdfReader,
  layoutToText,
  LOSSY_DISCIPLINES,
  MAX_FILE_BYTES,
  MAX_FILES_PER_BATCH,
  notConfiguredRepository,
  PdfTextUnavailableError,
  selectTitleBlockText,
  toDataDiscipline,
  unavailablePdfTextReader,
  validateBatch,
  validateUpload,
  type PdfPageText,
  type PdfTextSourceModule,
} from "./index";

const ok = { name: "A-101.pdf", size: 2_400_000, type: "application/pdf" };

describe("upload policy", () => {
  it("accepts a normal PDF sheet", () => {
    expect(validateUpload(ok)).toEqual({ ok: true, kind: "PDF", extension: "pdf" });
  });

  it("accepts CAD files the browser reports as octet-stream", () => {
    for (const [ext, kind] of Object.entries(ACCEPTED_EXTENSIONS)) {
      const v = validateUpload({ name: `A-101.${ext}`, size: 1000, type: "application/octet-stream" });
      expect(v, ext).toEqual({ ok: true, kind, extension: ext });
    }
  });

  it("accepts CAD files with an empty MIME type", () => {
    expect(validateUpload({ name: "S-301.dwg", size: 1000, type: "" })).toMatchObject({ ok: true });
  });

  it("rejects an executable outright", () => {
    const v = validateUpload({ name: "payload.exe", size: 10, type: "application/octet-stream" });
    expect(v).toMatchObject({ ok: false, code: "EXECUTABLE" });
  });

  it("rejects a double extension in either order", () => {
    expect(validateUpload({ name: "A-101.pdf.exe", size: 10, type: "" })).toMatchObject({
      ok: false,
      code: "EXECUTABLE",
    });
    expect(validateUpload({ name: "A-101.exe.pdf", size: 10, type: "application/pdf" })).toMatchObject({
      ok: false,
      code: "EXECUTABLE",
    });
  });

  it("rejects an unknown extension", () => {
    expect(validateUpload({ name: "notes.docx", size: 10, type: "" })).toMatchObject({
      ok: false,
      code: "EXTENSION_NOT_ALLOWED",
    });
  });

  it("rejects a file with no extension", () => {
    expect(validateUpload({ name: "A-101", size: 10, type: "" })).toMatchObject({
      ok: false,
      code: "NO_EXTENSION",
    });
  });

  it("rejects a .pdf the browser thinks is HTML", () => {
    expect(validateUpload({ name: "A-101.pdf", size: 10, type: "text/html" })).toMatchObject({
      ok: false,
      code: "MIME_MISMATCH",
    });
  });

  it("rejects an empty file", () => {
    expect(validateUpload({ ...ok, size: 0 })).toMatchObject({ ok: false, code: "EMPTY_FILE" });
  });

  it("rejects a file over the size cap", () => {
    expect(validateUpload({ ...ok, size: MAX_FILE_BYTES + 1 })).toMatchObject({
      ok: false,
      code: "TOO_LARGE",
    });
    expect(validateUpload({ ...ok, size: MAX_FILE_BYTES })).toMatchObject({ ok: true });
  });

  it("rejects a path or control characters in the name", () => {
    expect(validateUpload({ ...ok, name: "../../etc/passwd.pdf" })).toMatchObject({
      ok: false,
      code: "PATH_IN_NAME",
    });
    expect(validateUpload({ ...ok, name: `A-101${String.fromCharCode(0)}.pdf` })).toMatchObject({
      ok: false,
      code: "CONTROL_CHARS",
    });
  });

  it("caps the batch size", () => {
    const many = Array.from({ length: MAX_FILES_PER_BATCH + 1 }, () => ok);
    const { batchError, verdicts } = validateBatch(many);
    expect(batchError).toMatch(new RegExp(String(MAX_FILES_PER_BATCH)));
    expect(verdicts).toHaveLength(0);
  });

  it("validates a batch at the cap", () => {
    const many = Array.from({ length: MAX_FILES_PER_BATCH }, () => ok);
    const { batchError, verdicts } = validateBatch(many);
    expect(batchError).toBeNull();
    expect(verdicts.every((v) => v.ok)).toBe(true);
  });

  it("never throws on hostile input", () => {
    const hostile = [
      { name: "", size: 0, type: "" },
      { name: "x".repeat(500) + ".pdf", size: 1, type: "" },
      { name: "A-101.pdf", size: Number.NaN, type: "" },
      { name: "A-101.pdf", size: -1, type: "" },
    ];
    for (const h of hostile) expect(() => validateUpload(h)).not.toThrow();
  });
});

/* ------------------------------------------------------------------ */

function item(text: string, x: number, y: number) {
  return { text, x, y, width: text.length * 6, height: 10 };
}

describe("title-block region", () => {
  // A1 landscape in points: 2384 x 1684.
  const page: PdfPageText = {
    pageNumber: 1,
    width: 2384,
    height: 1684,
    items: [
      // Plan area — noise that must be excluded.
      item("101", 400, 1200),
      item("LIVING", 420, 1180),
      item("102", 700, 1200),
      item("BEDROOM 1", 720, 1180),
      item("GENERAL NOTES", 200, 900),
      // Right-hand title block.
      item("PROJECT NO:", 1900, 300),
      item("ZA-2026-014", 2100, 300),
      item("SHEET NO:", 1900, 240),
      item("A-101", 2100, 240),
      item("REV:", 1900, 180),
      item("C", 2100, 180),
    ],
  };

  it("keeps the title block and drops the plan area", () => {
    const r = selectTitleBlockText(page);
    expect(r.usedWholePage).toBe(false);
    expect(r.text).toContain("SHEET NO: A-101");
    expect(r.text).toContain("PROJECT NO: ZA-2026-014");
    expect(r.text).not.toContain("BEDROOM");
    expect(r.text).not.toContain("GENERAL NOTES");
  });

  it("reassembles draw-order items into reading order", () => {
    const shuffled: PdfPageText = { ...page, items: [...page.items].reverse() };
    expect(selectTitleBlockText(shuffled).text).toBe(selectTitleBlockText(page).text);
  });

  it("falls back to the whole page when the strips are empty", () => {
    const centred: PdfPageText = {
      pageNumber: 1,
      width: 2384,
      height: 1684,
      items: [item("SHEET NO: A-101 REV: C PROJECT: SOMETHING", 900, 900)],
    };
    const r = selectTitleBlockText(centred);
    expect(r.usedWholePage).toBe(true);
    expect(r.text).toContain("A-101");
  });

  it("handles a page with no items", () => {
    const r = selectTitleBlockText({ pageNumber: 1, width: 100, height: 100, items: [] });
    expect(r).toEqual({ text: "", usedWholePage: false, itemCount: 0 });
  });

  it("groups items on the same baseline into one line", () => {
    const text = layoutToText([item("DATE:", 10, 100), item("2026-08-04", 60, 101), item("REV: C", 10, 50)]);
    expect(text).toBe("DATE: 2026-08-04\nREV: C");
  });
});

/* ------------------------------------------------------------------ */

describe("pdf text reader adapter", () => {
  it("fails closed when no reader is configured", async () => {
    await expect(unavailablePdfTextReader.read(new Uint8Array())).rejects.toBeInstanceOf(
      PdfTextUnavailableError,
    );
  });

  it("maps a pdf.js-shaped module onto PdfPageText", async () => {
    const fake: PdfTextSourceModule = {
      async getDocumentProxy() {
        return {
          numPages: 3,
          async getPage() {
            return {
              getViewport: () => ({ width: 2384, height: 1684 }),
              async getTextContent() {
                return {
                  items: [
                    {
                      str: "SHEET NO: A-101   REV: C",
                      transform: [1, 0, 0, 1, 1900, 240],
                      width: 140,
                      height: 10,
                    },
                    { str: "   ", transform: [1, 0, 0, 1, 10, 10], width: 5, height: 10 },
                  ],
                };
              },
            };
          },
        };
      },
    };
    const doc = await createUnpdfReader(async () => fake).read(new Uint8Array([1]));
    expect(doc.pageCount).toBe(3);
    expect(doc.pages).toHaveLength(1); // maxPages defaults to 1
    expect(doc.pages[0].items).toHaveLength(1); // whitespace-only item dropped
    expect(doc.pages[0].items[0]).toMatchObject({ x: 1900, y: 240 });
    expect(doc.hasTextLayer).toBe(true);
  });

  it("reports a scanned PDF as having no text layer", async () => {
    const doc = await createStubReader([
      { pageNumber: 1, width: 2384, height: 1684, items: [item("x", 10, 10)] },
    ]).read(new Uint8Array());
    expect(doc.hasTextLayer).toBe(false);
    expect(doc.charCount).toBe(1);
  });
});

/* ------------------------------------------------------------------ */

describe("persistence seam", () => {
  it("every method rejects with an explicit, actionable error", async () => {
    await expect(
      notConfiguredRepository.createUploadTicket({
        projectId: "p",
        filename: "A-101.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1,
      }),
    ).rejects.toBeInstanceOf(DrawingPersistenceNotConfiguredError);
    await expect(notConfiguredRepository.findSheets("p", "A-101")).rejects.toBeInstanceOf(
      DrawingPersistenceNotConfiguredError,
    );
  });
});

describe("discipline mapping", () => {
  it("collapses M/E/P onto the stored MEP bucket", () => {
    expect(toDataDiscipline("MECHANICAL")).toBe("MEP");
    expect(toDataDiscipline("ELECTRICAL")).toBe("MEP");
    expect(toDataDiscipline("PLUMBING")).toBe("MEP");
  });

  it("maps the disciplines the stored union does represent faithfully", () => {
    expect(toDataDiscipline("ARCHITECTURAL")).toBe("ARCHITECTURE");
    expect(toDataDiscipline("STRUCTURAL")).toBe("STRUCTURAL");
    expect(toDataDiscipline("INTERIORS")).toBe("INTERIOR");
  });

  // These three used to be filed under the nearest wrong heading because the
  // register's union had nowhere to put them. It does now, and a landscape
  // sheet that arrives as landscape is the whole point of the widening.
  it("no longer misfiles civil, landscape and general sheets", () => {
    expect(toDataDiscipline("CIVIL")).toBe("CIVIL");
    expect(toDataDiscipline("LANDSCAPE")).toBe("LANDSCAPE");
    expect(toDataDiscipline("GENERAL")).toBe("GENERAL");
  });

  it("declares exactly the disciplines it still narrows", () => {
    expect([...LOSSY_DISCIPLINES].sort()).toEqual(
      ["ELECTRICAL", "FIRE_PROTECTION", "MECHANICAL", "PLUMBING", "TELECOM"].sort(),
    );
  });
});
