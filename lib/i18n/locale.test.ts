/**
 * Dates follow the UI language; English does not change.
 */
import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/format";
import { DATE_LOCALE, dateLocale } from "./locale";
import { LANG_CODES } from "./types";

const D = new Date(Date.UTC(2026, 8, 27, 12));

describe("date locale", () => {
  it("covers every UI language", () => {
    for (const l of LANG_CODES) expect(DATE_LOCALE[l]).toBeTruthy();
  });

  it("leaves English exactly as it was", () => {
    expect(formatDate(D, dateLocale("en"))).toBe(formatDate(D));
  });

  it("writes the month in the viewer's language", () => {
    expect(formatDate(D, dateLocale("nl"))).toMatch(/sep/);
    expect(formatDate(D, dateLocale("es"))).toMatch(/sept?/);
    expect(formatDate(D, dateLocale("de"))).toMatch(/Sept/);
    expect(formatDate(D, dateLocale("ja"))).toContain("2026年");
    expect(formatDate(D, dateLocale("zh"))).toContain("2026年");
    expect(formatDate(D, dateLocale("pt"))).toMatch(/set/);
  });

  it("still shows a dash for no date, in any language", () => {
    expect(formatDate(null, dateLocale("ja"))).toBe("—");
  });
});
