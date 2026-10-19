import { describe, expect, it } from "vitest";
import {
  DEFAULT_INVOICE_SETTINGS,
  MAX_BANK_DETAILS_CHARS,
  MAX_TERMS_DAYS,
  MAX_TERMS_FONT_PT,
  MIN_TERMS_FONT_PT,
  parseInvoiceSettings,
  termsPlacement,
} from "./invoice-settings";

describe("parseInvoiceSettings", () => {
  it("gives the defaults for nothing stored", () => {
    expect(parseInvoiceSettings(undefined)).toEqual(DEFAULT_INVOICE_SETTINGS);
    expect(parseInvoiceSettings(null)).toEqual(DEFAULT_INVOICE_SETTINGS);
    expect(parseInvoiceSettings("junk")).toEqual(DEFAULT_INVOICE_SETTINGS);
  });

  it("defaults to 30 days and the T&C on a second page", () => {
    expect(DEFAULT_INVOICE_SETTINGS.defaultTermsDays).toBe(30);
    expect(DEFAULT_INVOICE_SETTINGS.termsOnSecondPage).toBe(true);
  });

  it("keeps valid values", () => {
    const s = parseInvoiceSettings({
      defaultTermsDays: 14,
      bankDetails: "Aruba Bank\nAcct 123",
      termsText: "Payment within 14 days.",
      termsOnSecondPage: false,
      termsFontSize: 9,
    });
    expect(s).toEqual({
      defaultTermsDays: 14,
      bankDetails: "Aruba Bank\nAcct 123",
      termsText: "Payment within 14 days.",
      termsOnSecondPage: false,
      termsFontSize: 9,
    });
  });

  it("clamps numbers instead of rejecting them, and reads numeric strings", () => {
    expect(parseInvoiceSettings({ defaultTermsDays: 400 }).defaultTermsDays).toBe(MAX_TERMS_DAYS);
    expect(parseInvoiceSettings({ defaultTermsDays: -5 }).defaultTermsDays).toBe(0);
    expect(parseInvoiceSettings({ defaultTermsDays: "45" }).defaultTermsDays).toBe(45);
    expect(parseInvoiceSettings({ defaultTermsDays: 10.6 }).defaultTermsDays).toBe(11);
    expect(parseInvoiceSettings({ defaultTermsDays: "abc" }).defaultTermsDays).toBe(30);
    expect(parseInvoiceSettings({ defaultTermsDays: "" }).defaultTermsDays).toBe(30);
    expect(parseInvoiceSettings({ termsFontSize: 1 }).termsFontSize).toBe(MIN_TERMS_FONT_PT);
    expect(parseInvoiceSettings({ termsFontSize: 99 }).termsFontSize).toBe(MAX_TERMS_FONT_PT);
  });

  it("normalises line endings, drops trailing blank lines and caps the length", () => {
    expect(parseInvoiceSettings({ bankDetails: "A\r\nB\r\n\r\n" }).bankDetails).toBe("A\nB");
    expect(parseInvoiceSettings({ bankDetails: "x".repeat(5000) }).bankDetails).toHaveLength(MAX_BANK_DETAILS_CHARS);
    expect(parseInvoiceSettings({ bankDetails: 42 }).bankDetails).toBe("");
  });

  it("only takes a real boolean for the second-page switch", () => {
    expect(parseInvoiceSettings({ termsOnSecondPage: "false" }).termsOnSecondPage).toBe(true);
    expect(parseInvoiceSettings({ termsOnSecondPage: false }).termsOnSecondPage).toBe(false);
  });
});

describe("termsPlacement", () => {
  it("prints nothing without text, else inline or on a second sheet", () => {
    expect(termsPlacement({ termsText: "  ", termsOnSecondPage: true })).toBe("none");
    expect(termsPlacement({ termsText: "T&C", termsOnSecondPage: true })).toBe("second-page");
    expect(termsPlacement({ termsText: "T&C", termsOnSecondPage: false })).toBe("inline");
  });
});
