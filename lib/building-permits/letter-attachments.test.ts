/**
 * A letter's files: the first is the letter, the rest are its attachments.
 */
import { describe, expect, it } from "vitest";
import { attachmentName, splitLetterFiles } from "./letter-file";

describe("splitLetterFiles", () => {
  it("has nothing for a letter with no files", () => {
    expect(splitLetterFiles([])).toEqual({ letter: null, attachments: [] });
  });

  it("makes the only file the letter", () => {
    expect(splitLetterFiles(["a"])).toEqual({ letter: "a", attachments: [] });
  });

  it("keeps every file after the first as an attachment, in upload order", () => {
    expect(splitLetterFiles(["letter", "drawing", "checklist"])).toEqual({
      letter: "letter",
      attachments: ["drawing", "checklist"],
    });
  });
});

describe("attachmentName", () => {
  it("drops the .pdf extension, whatever its case", () => {
    expect(attachmentName("Stamped site plan.PDF")).toBe("Stamped site plan");
  });

  it("never returns an empty name", () => {
    expect(attachmentName(".pdf")).toBe("Attachment");
  });
});
