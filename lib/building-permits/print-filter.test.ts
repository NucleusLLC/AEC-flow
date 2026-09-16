import { describe, expect, it } from "vitest";
import { describePermitPrintScope, parsePermitPrintQuery } from "./print-filter";

describe("parsePermitPrintQuery", () => {
  it("defaults to the screen's own defaults", () => {
    expect(parsePermitPrintQuery()).toEqual({
      status: "ALL",
      permitType: "ALL",
      authority: undefined,
      q: undefined,
      band: "status",
      sort: "submitted",
      dir: "desc",
      orientation: "landscape",
    });
  });

  it("carries a real filter through", () => {
    const r = parsePermitPrintQuery({
      status: "INFO_REQUESTED",
      type: "RENOVATION",
      authority: " DOW ",
      q: "  sabana ",
      band: "authority",
      sort: "ready",
      dir: "asc",
      orientation: "portrait",
    });
    expect(r).toEqual({
      status: "INFO_REQUESTED",
      permitType: "RENOVATION",
      authority: "DOW",
      q: "sabana",
      band: "authority",
      sort: "ready",
      dir: "asc",
      orientation: "portrait",
    });
  });

  it("keeps OPEN, which is a filter and not a status", () => {
    expect(parsePermitPrintQuery({ status: "OPEN" }).status).toBe("OPEN");
  });

  it("falls back rather than trusting a hand-edited URL", () => {
    const r = parsePermitPrintQuery({
      status: "NONSENSE",
      type: "NONSENSE",
      band: "NONSENSE",
      sort: "NONSENSE",
      dir: "sideways",
      orientation: "diagonal",
      authority: "   ",
      q: "",
    });
    expect(r.status).toBe("ALL");
    expect(r.permitType).toBe("ALL");
    expect(r.band).toBe("status");
    expect(r.sort).toBe("submitted");
    expect(r.dir).toBe("desc");
    expect(r.orientation).toBe("landscape");
    expect(r.authority).toBeUndefined();
    expect(r.q).toBeUndefined();
  });
});

describe("describePermitPrintScope", () => {
  it("says so when nothing is filtered", () => {
    expect(describePermitPrintScope(parsePermitPrintQuery())).toBe("Every permit");
  });

  it("names every active filter", () => {
    const scope = describePermitPrintScope(
      parsePermitPrintQuery({ status: "OPEN", type: "POOL", authority: "DOW", q: "malmok" }),
    );
    expect(scope).toBe("Open files · Pool · DOW · matching “malmok”");
  });
});
