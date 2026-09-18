import { describe, expect, it } from "vitest";
import {
  INITIAL_VERSION,
  bumpDraftVersion,
  formatVersion,
  isIssuedVersion,
  issuedVersion,
  parseVersion,
  revisionStartVersion,
  nextRevisionVersion,
  versionDisplay,
} from "./versioning";

describe("parseVersion", () => {
  it("reads a well-formed label", () => {
    expect(parseVersion("1.2")).toEqual({ major: 1, minor: 2 });
    expect(parseVersion("10.11")).toEqual({ major: 10, minor: 11 });
  });

  it("tolerates surrounding and inner whitespace", () => {
    expect(parseVersion(" 2 . 3 ")).toEqual({ major: 2, minor: 3 });
  });

  // Every proposal written before this rule existed has a null label; they must join the
  // scheme on their next save rather than throw.
  it("reads null, undefined and rubbish as 0.0", () => {
    expect(parseVersion(null)).toEqual({ major: 0, minor: 0 });
    expect(parseVersion(undefined)).toEqual({ major: 0, minor: 0 });
    expect(parseVersion("")).toEqual({ major: 0, minor: 0 });
    expect(parseVersion("draft")).toEqual({ major: 0, minor: 0 });
    expect(parseVersion("1")).toEqual({ major: 0, minor: 0 });
    expect(parseVersion("1.2.3")).toEqual({ major: 0, minor: 0 });
  });
});

describe("bumpDraftVersion", () => {
  it("moves the minor on every save", () => {
    expect(bumpDraftVersion(INITIAL_VERSION)).toBe("0.2");
    expect(bumpDraftVersion("0.2")).toBe("0.3");
    expect(bumpDraftVersion("1.1")).toBe("1.2");
  });

  it("never moves the major", () => {
    expect(bumpDraftVersion("3.9")).toBe("3.10");
  });

  it("takes a legacy null onto the scheme at 0.1", () => {
    expect(bumpDraftVersion(null)).toBe(INITIAL_VERSION);
  });
});

describe("issuedVersion", () => {
  it("rounds a draft up to the next whole number", () => {
    expect(issuedVersion("0.3")).toBe("1.0");
    expect(issuedVersion("1.2")).toBe("2.0");
  });

  it("advances even from an already-whole label", () => {
    // Reaching issue again means there is a new thing to send.
    expect(issuedVersion("1.0")).toBe("2.0");
  });

  it("issues a never-saved proposal as 1.0", () => {
    expect(issuedVersion(null)).toBe("1.0");
  });
});

describe("revisionStartVersion", () => {
  it("continues from the issued major at minor 1", () => {
    expect(revisionStartVersion("1.0")).toBe("1.1");
    expect(revisionStartVersion("2.0")).toBe("2.1");
  });

  it("round-trips: a revision of 1.0 issues as 2.0", () => {
    expect(issuedVersion(revisionStartVersion("1.0"))).toBe("2.0");
  });
});

describe("the documented lifecycle", () => {
  it("walks create → edit → issue → revise → edit → issue", () => {
    let v = INITIAL_VERSION;
    expect(v).toBe("0.1");
    v = bumpDraftVersion(v);
    expect(v).toBe("0.2");
    v = bumpDraftVersion(v);
    expect(v).toBe("0.3");
    v = issuedVersion(v);
    expect(v).toBe("1.0");
    expect(isIssuedVersion(v)).toBe(true);
    v = revisionStartVersion(v);
    expect(v).toBe("1.1");
    expect(isIssuedVersion(v)).toBe(false);
    v = bumpDraftVersion(v);
    expect(v).toBe("1.2");
    v = issuedVersion(v);
    expect(v).toBe("2.0");
    expect(isIssuedVersion(v)).toBe(true);
  });

  it("gives every issued version a distinct whole number", () => {
    const issued: string[] = [];
    let v: string = INITIAL_VERSION;
    for (let cycle = 0; cycle < 5; cycle += 1) {
      v = bumpDraftVersion(v);
      v = issuedVersion(v);
      issued.push(v);
      v = revisionStartVersion(v);
    }
    expect(issued).toEqual(["1.0", "2.0", "3.0", "4.0", "5.0"]);
    expect(new Set(issued).size).toBe(issued.length);
  });
});

describe("isIssuedVersion", () => {
  it("is true only for a whole number above zero", () => {
    expect(isIssuedVersion("1.0")).toBe(true);
    expect(isIssuedVersion("0.0")).toBe(false);
    expect(isIssuedVersion("1.1")).toBe(false);
    expect(isIssuedVersion(null)).toBe(false);
  });
});

describe("versionDisplay", () => {
  it("prefixes a v", () => {
    expect(versionDisplay("1.2")).toBe("v1.2");
  });

  it("invents nothing for a document with no version", () => {
    expect(versionDisplay(null)).toBeNull();
    expect(versionDisplay("")).toBeNull();
  });
});

describe("formatVersion", () => {
  it("round-trips through parseVersion", () => {
    for (const label of ["0.1", "1.0", "2.7", "10.11"]) {
      expect(formatVersion(parseVersion(label))).toBe(label);
    }
  });
});

describe("nextRevisionVersion", () => {
  it("starts an issued document's revision at .1", () => {
    expect(nextRevisionVersion("1.0")).toBe("1.1");
    expect(nextRevisionVersion("2.0")).toBe("2.1");
  });

  it("moves one decimal when what is being revised is already in progress", () => {
    // The reported bug: revising twice left the label where it was, so two
    // different documents both read 1.1.
    expect(nextRevisionVersion("1.1")).toBe("1.2");
    expect(nextRevisionVersion("1.2")).toBe("1.3");
  });

  it("never moves a draft backwards", () => {
    // revisionStartVersion("0.3") is "0.1" — earlier than where the document
    // already was.
    expect(nextRevisionVersion("0.3")).toBe("0.4");
    expect(nextRevisionVersion("0.1")).toBe("0.2");
  });

  it("leaves the major alone: reaching a whole number is what ISSUING does", () => {
    for (const label of ["1.0", "1.1", "0.3", null]) {
      expect(parseVersion(nextRevisionVersion(label)).major).toBe(parseVersion(label).major);
    }
  });

  it("puts an unlabelled legacy proposal onto the scheme rather than erroring", () => {
    expect(nextRevisionVersion(null)).toBe("0.1");
    expect(nextRevisionVersion("")).toBe("0.1");
    expect(nextRevisionVersion("draft")).toBe("0.1");
  });

  it("still issues to the next whole number afterwards", () => {
    expect(issuedVersion(nextRevisionVersion("1.0"))).toBe("2.0");
    expect(issuedVersion(nextRevisionVersion("1.1"))).toBe("2.0");
  });

  it("a chain of revisions produces distinct labels", () => {
    let v = "1.0";
    const seen = [v];
    for (let i = 0; i < 4; i++) {
      v = nextRevisionVersion(v);
      seen.push(v);
    }
    expect(seen).toEqual(["1.0", "1.1", "1.2", "1.3", "1.4"]);
    expect(new Set(seen).size).toBe(seen.length);
  });
});
