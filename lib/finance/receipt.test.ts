import { describe, expect, it } from "vitest";
import {
  RECEIPT_MAX_BYTES,
  buildReceiptKey,
  canChangeReceipt,
  canViewReceipt,
  formatReceiptSize,
  isReceiptKeyForExpense,
  normaliseReceiptMime,
  receiptDisplayName,
  validateReceipt,
} from "./receipt";

describe("validateReceipt", () => {
  it.each([
    ["till.jpg", "image/jpeg"],
    ["till.png", "image/png"],
    ["till.webp", "image/webp"],
    ["IMG_0042.HEIC", "image/heic"],
    ["invoice.pdf", "application/pdf"],
  ])("accepts %s as %s", (name, type) => {
    expect(validateReceipt({ name, size: 2048, type })).toEqual({ ok: true, mimeType: type });
  });

  it("falls back to the extension when the browser reports no type (HEIC)", () => {
    expect(validateReceipt({ name: "IMG_0042.heic", size: 2048, type: "" })).toEqual({
      ok: true,
      mimeType: "image/heic",
    });
    expect(validateReceipt({ name: "photo.JPEG", size: 2048, type: "" })).toEqual({
      ok: true,
      mimeType: "image/jpeg",
    });
  });

  it("normalises the aliases browsers use", () => {
    expect(normaliseReceiptMime("image/jpg")).toBe("image/jpeg");
    expect(normaliseReceiptMime("image/heif")).toBe("image/heic");
    expect(normaliseReceiptMime("application/pdf; charset=binary")).toBe("application/pdf");
    expect(normaliseReceiptMime("text/html")).toBeNull();
  });

  it("refuses a type that is not a photo or a PDF, whatever the extension says", () => {
    expect(validateReceipt({ name: "receipt.pdf", size: 10, type: "text/html" }).ok).toBe(false);
    expect(validateReceipt({ name: "logo.svg", size: 10, type: "image/svg+xml" }).ok).toBe(false);
    expect(validateReceipt({ name: "sheet.xlsx", size: 10, type: "" }).ok).toBe(false);
    expect(validateReceipt({ name: "noextension", size: 10, type: "" }).ok).toBe(false);
  });

  it("refuses empty and oversized files, and a nameless one", () => {
    expect(validateReceipt({ name: "a.pdf", size: 0, type: "application/pdf" }).ok).toBe(false);
    expect(validateReceipt({ name: "a.pdf", size: RECEIPT_MAX_BYTES, type: "application/pdf" }).ok).toBe(true);
    expect(validateReceipt({ name: "a.pdf", size: RECEIPT_MAX_BYTES + 1, type: "application/pdf" })).toEqual({
      ok: false,
      message: "The receipt is larger than 10 MB.",
    });
    expect(validateReceipt({ name: "  ", size: 10, type: "application/pdf" }).ok).toBe(false);
  });
});

describe("receipt storage keys", () => {
  it("builds receipts/<expenseId>/<uploadId>/<safe filename>", () => {
    expect(buildReceiptKey("exp1", "Shell receipt (12 Oct).JPG", "u-1")).toBe(
      "receipts/exp1/u-1/Shell-receipt-12-Oct.jpg",
    );
  });

  it("recognises a key issued for the same expense only", () => {
    const key = buildReceiptKey("exp1", "a.pdf", "u-1");
    expect(isReceiptKeyForExpense(key, "exp1")).toBe(true);
    expect(isReceiptKeyForExpense(key, "exp2")).toBe(false);
    expect(isReceiptKeyForExpense(key, "exp")).toBe(false);
  });

  it("rejects traversal, nesting, other prefixes and odd expense ids", () => {
    expect(isReceiptKeyForExpense("receipts/exp1/../exp2/u/a.pdf", "exp1")).toBe(false);
    expect(isReceiptKeyForExpense("receipts/exp1/u/x/a.pdf", "exp1")).toBe(false);
    expect(isReceiptKeyForExpense("permits/exp1/letters/u/a.pdf", "exp1")).toBe(false);
    expect(isReceiptKeyForExpense("receipts/exp1/u/a.pdf", "exp1/u")).toBe(false);
    expect(isReceiptKeyForExpense("", "exp1")).toBe(false);
  });
});

describe("who may see and change a receipt", () => {
  const owner = { id: "u1", isAdmin: false };
  const colleague = { id: "u2", isAdmin: false };
  const admin = { id: "u3", isAdmin: true };
  const draft = { userId: "u1", status: "DRAFT" as const, invoicedAt: null };

  it("shows it to the person who recorded it and to administrators only", () => {
    expect(canViewReceipt(draft, owner)).toBe(true);
    expect(canViewReceipt(draft, admin)).toBe(true);
    expect(canViewReceipt(draft, colleague)).toBe(false);
  });

  it("lets the owner change it while the expense is editable", () => {
    expect(canChangeReceipt(draft, owner)).toBe(true);
    expect(canChangeReceipt({ ...draft, status: "SUBMITTED" }, owner)).toBe(true);
    expect(canChangeReceipt({ ...draft, status: "REJECTED" }, owner)).toBe(true);
    expect(canChangeReceipt({ ...draft, status: "APPROVED" }, owner)).toBe(false);
    expect(canChangeReceipt(draft, colleague)).toBe(false);
  });

  it("lets an administrator change it until it is invoiced", () => {
    expect(canChangeReceipt({ ...draft, status: "APPROVED" }, admin)).toBe(true);
  });

  it("freezes it for everybody once the expense is on an invoice", () => {
    const invoiced = { ...draft, status: "APPROVED" as const, invoicedAt: "2026-10-01T00:00:00.000Z" };
    expect(canChangeReceipt(invoiced, owner)).toBe(false);
    expect(canChangeReceipt(invoiced, admin)).toBe(false);
    // Still viewable: frozen is not hidden.
    expect(canViewReceipt(invoiced, owner)).toBe(true);
  });
});

describe("display helpers", () => {
  it("keeps the person's filename, cleaned of line breaks", () => {
    expect(receiptDisplayName("Shell\nreceipt.jpg", "image/jpeg")).toBe("Shell receipt.jpg");
    expect(receiptDisplayName("", "application/pdf")).toBe("receipt.pdf");
  });

  it("formats sizes", () => {
    expect(formatReceiptSize(340 * 1024)).toBe("340 KB");
    expect(formatReceiptSize(1.25 * 1024 * 1024)).toBe("1.3 MB");
    expect(formatReceiptSize(0)).toBe("");
  });
});
