import { describe, it, expect, beforeEach } from "vitest";
import {
  setFirmIdentity,
  getFirmIdentity,
  firmName,
  firmLocation,
  firmLogo,
  practiceLocationLine,
  documentFooterLine,
} from "@/lib/firm-identity";

/**
 * These guard the fix for the bug where every tenant's printed documents carried
 * the founder company's identity ("ZenArch Consultants · Dubai, United Arab
 * Emirates"). The rule under test: a document never invents a firm name or an
 * address it was not given.
 */

beforeEach(() => {
  setFirmIdentity({ name: "", location: "", logo: { dataUrl: null, position: "left", size: 56 } });
});

describe("firmName", () => {
  it("prefers an explicit override", () => {
    setFirmIdentity({ name: "Seeded Firm", location: "" });
    expect(firmName("Uzca Architects")).toBe("Uzca Architects");
  });

  it("falls back to the seeded identity when no override is passed", () => {
    setFirmIdentity({ name: "Uzca Architects", location: "" });
    expect(firmName()).toBe("Uzca Architects");
  });

  it("falls back to the neutral product wordmark, never another firm's name", () => {
    expect(firmName()).toBe("AEC-flow");
    expect(firmName("   ")).toBe("AEC-flow");
  });

  it("honours a caller-supplied fallback", () => {
    expect(firmName(undefined, "Practice")).toBe("Practice");
  });
});

describe("firmLocation", () => {
  it("returns an empty string when nothing is configured, so callers drop the segment", () => {
    expect(firmLocation()).toBe("");
  });

  it("prefers the override, then the seeded value", () => {
    setFirmIdentity({ name: "", location: "Oranjestad, Aruba" });
    expect(firmLocation()).toBe("Oranjestad, Aruba");
    expect(firmLocation("Dubai, UAE")).toBe("Dubai, UAE");
  });
});

describe("practiceLocationLine", () => {
  it("joins city, region and country", () => {
    expect(practiceLocationLine({ city: "Dubai", emirate: "Dubai", country: "UAE" })).toBe("Dubai, UAE");
  });

  it("de-duplicates a region that merely repeats the city", () => {
    expect(practiceLocationLine({ city: "Oranjestad", emirate: "Oranjestad", country: "Aruba" })).toBe(
      "Oranjestad, Aruba",
    );
  });

  it("drops n/a-style placeholders testers type into the optional region field", () => {
    expect(practiceLocationLine({ city: "Oranjestad", emirate: "Na", country: "Aruba" })).toBe("Oranjestad, Aruba");
    expect(practiceLocationLine({ city: "Oranjestad", emirate: "N/A", country: "Aruba" })).toBe("Oranjestad, Aruba");
    expect(practiceLocationLine({ city: "Oranjestad", emirate: "-", country: "Aruba" })).toBe("Oranjestad, Aruba");
  });

  it("returns an empty string for a wholly unconfigured profile", () => {
    expect(practiceLocationLine({})).toBe("");
    expect(practiceLocationLine({ city: "  ", emirate: "", country: undefined })).toBe("");
  });
});

describe("documentFooterLine", () => {
  it("joins the segments it is given", () => {
    expect(documentFooterLine("Uzca Architects", "Oranjestad, Aruba", "PRP-004")).toBe(
      "Uzca Architects · Oranjestad, Aruba · PRP-004",
    );
  });

  it("omits empty segments instead of leaving dangling separators", () => {
    expect(documentFooterLine("Uzca Architects", "", "PRP-004")).toBe("Uzca Architects · PRP-004");
    expect(documentFooterLine("Uzca Architects", undefined, null, "PRP-004", "")).toBe("Uzca Architects · PRP-004");
  });
});

describe("setFirmIdentity", () => {
  it("trims what it stores and ignores a null seed", () => {
    setFirmIdentity({ name: "  Uzca Architects  ", location: "  Aruba  " });
    expect(getFirmIdentity().name).toBe("Uzca Architects");
    expect(getFirmIdentity().location).toBe("Aruba");
    setFirmIdentity(null);
    expect(getFirmIdentity().name).toBe("Uzca Architects");
  });
});

describe("firmLogo", () => {
  const LOGO = { dataUrl: "data:image/png;base64,AAA", position: "right" as const, size: 72 };

  it("returns the configured logo when a caller passes none — the preview-modal case", () => {
    setFirmIdentity({ name: "ZenArch", location: "", logo: LOGO });
    expect(firmLogo()).toEqual(LOGO);
    expect(firmLogo(undefined)).toEqual(LOGO);
  });

  it("lets an explicit logo win", () => {
    setFirmIdentity({ name: "ZenArch", location: "", logo: LOGO });
    expect(firmLogo({ dataUrl: "data:image/png;base64,BBB" }).dataUrl).toBe("data:image/png;base64,BBB");
  });

  it("falls back field by field, so a bare data URL still inherits position and size", () => {
    setFirmIdentity({ name: "ZenArch", location: "", logo: LOGO });
    expect(firmLogo({ dataUrl: "data:image/png;base64,BBB" })).toEqual({
      dataUrl: "data:image/png;base64,BBB",
      position: "right",
      size: 72,
    });
  });

  it("reports no logo when none is configured, so the wordmark shows instead", () => {
    expect(firmLogo().dataUrl).toBeNull();
    expect(firmLogo({ dataUrl: null }).dataUrl).toBeNull();
  });
});
