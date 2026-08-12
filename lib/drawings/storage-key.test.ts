/**
 * Storage keys. These are the names the private bucket is organised by and the
 * only thing standing between "upload a file" and "write to any object in the
 * bucket", so the cases below are mostly about what must NOT get through.
 */

import { describe, expect, it } from "vitest";
import { buildStorageKey, isKeyForProject, projectDrawingPrefix, sanitiseFilename } from "./storage-key";

const PROJECT = "clp1234project";
const UPLOAD = "0f8c1a2b-3d4e-4f60-9a1b-2c3d4e5f6071";

describe("sanitiseFilename", () => {
  it("keeps an ordinary sheet name intact", () => {
    expect(sanitiseFilename("ZA-2026-121_A-101_Rev-B.pdf")).toBe("ZA-2026-121_A-101_Rev-B.pdf");
  });

  it("lowercases the extension so keys of the same file agree", () => {
    expect(sanitiseFilename("A-101.PDF")).toBe("A-101.pdf");
  });

  it("strips path separators — the whole point of the segment", () => {
    expect(sanitiseFilename("../../etc/passwd.pdf")).not.toContain("/");
    expect(sanitiseFilename("..\\..\\secrets.dwg")).not.toContain("\\");
  });

  it("collapses spaces and punctuation rather than percent-encoding them", () => {
    expect(sanitiseFilename("Ground Floor Plan (final).pdf")).toBe("Ground-Floor-Plan-final.pdf");
  });

  it("never returns an empty name", () => {
    expect(sanitiseFilename("")).toBe("drawing");
    expect(sanitiseFilename("   ")).toBe("drawing");
    expect(sanitiseFilename("###")).toBe("drawing");
  });

  it("bounds the length so a long name cannot blow the key limit", () => {
    const long = `${"a".repeat(400)}.pdf`;
    expect(sanitiseFilename(long).length).toBeLessThanOrEqual(104);
  });
});

describe("buildStorageKey", () => {
  it("nests under the project, then the upload", () => {
    expect(buildStorageKey(PROJECT, "A-101.pdf", UPLOAD)).toBe(
      `projects/${PROJECT}/drawings/${UPLOAD}/A-101.pdf`,
    );
  });

  it("gives two uploads of the same filename different keys", () => {
    const a = buildStorageKey(PROJECT, "A-101.pdf", "upload-one");
    const b = buildStorageKey(PROJECT, "A-101.pdf", "upload-two");
    // Superseding must never overwrite the file that was issued.
    expect(a).not.toBe(b);
  });

  it("always sits under the project prefix, whatever the filename tries", () => {
    const key = buildStorageKey(PROJECT, "../escape.pdf", UPLOAD);
    expect(key.startsWith(projectDrawingPrefix(PROJECT))).toBe(true);
    expect(key).not.toContain("..");
  });
});

describe("isKeyForProject", () => {
  it("accepts a key this module issued", () => {
    expect(isKeyForProject(buildStorageKey(PROJECT, "A-101.pdf", UPLOAD), PROJECT)).toBe(true);
  });

  it("rejects another project's key", () => {
    expect(isKeyForProject(buildStorageKey("other-project", "A-101.pdf", UPLOAD), PROJECT)).toBe(false);
  });

  it("rejects traversal out of the prefix", () => {
    expect(isKeyForProject(`projects/${PROJECT}/drawings/../../../secrets.pdf`, PROJECT)).toBe(false);
  });

  it("rejects extra nesting a prefix policy would not expect", () => {
    expect(isKeyForProject(`projects/${PROJECT}/drawings/${UPLOAD}/deeper/A-101.pdf`, PROJECT)).toBe(false);
  });

  it("rejects the prefix on its own", () => {
    expect(isKeyForProject(projectDrawingPrefix(PROJECT), PROJECT)).toBe(false);
  });

  it("rejects rubbish", () => {
    expect(isKeyForProject("", PROJECT)).toBe(false);
    expect(isKeyForProject("A-101.pdf", PROJECT)).toBe(false);
  });
});
