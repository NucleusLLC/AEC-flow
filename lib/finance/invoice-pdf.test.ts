/**
 * The server-side PDFs (lib/finance/invoice-pdf.ts): they open as PDFs, break
 * onto further A4 sheets with "Page x of y" on every one, and carry the facts
 * the client is asked to pay — the number, the total, the discount, both
 * taxes, the balance — and a reversed receipt says REVERSED.
 *
 * The text is read back out of the file itself: each page's content stream is
 * inflated and its hex-encoded strings decoded, so the assertions are on what
 * a PDF reader would draw, not on what the builder meant to draw.
 */
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { PDFDocument, PDFArray, PDFRawStream, PDFName, type PDFPage } from "pdf-lib";
import { buildInvoicePdf, buildReceiptPdf, pdfToBase64 } from "./invoice-pdf";
import type { InvoiceDTO, InvoicePaymentDTO } from "./types";

const identity = (s: string) => s;

function payment(p: Partial<InvoicePaymentDTO> = {}): InvoicePaymentDTO {
  return {
    id: "p1",
    invoiceId: "i1",
    paidAt: "2026-10-05",
    amount: 500,
    method: "BANK_TRANSFER",
    reference: "BANK-REF-77",
    notes: null,
    recordedByName: "Ana",
    createdAt: "2026-10-05T10:00:00.000Z",
    receiptNumber: "RCT-2026-014",
    reversedAt: null,
    reversedByName: null,
    reverseReason: null,
    ...p,
  };
}

function invoice(p: Partial<InvoiceDTO> = {}): InvoiceDTO {
  return {
    id: "i1",
    number: "INV-2026-042",
    status: "SENT",
    currency: "AWG",
    clientId: null,
    clientName: "Casa Brava N.V.",
    projectId: null,
    projectName: "Villa Brava",
    proposalNumber: "SP-2026-009",
    title: "Architectural services — stage 2",
    issueDate: "2026-10-01",
    dueDate: "2026-10-31",
    subtotal: 1000,
    taxTotal: 27,
    tax2Total: 36,
    total: 963,
    paid: 500,
    credited: 0,
    outstanding: 463,
    discountTotal: 100,
    sentAt: null,
    paymentCount: 1,
    lineCount: 1,
    updatedAt: "",
    contactName: "M. Brava",
    contactEmail: "m@example.com",
    billingAddress: "Palm Beach 12, Aruba",
    serviceProposalId: null,
    intro: "Design development as agreed.",
    termsDays: 30,
    taxName: "BBO",
    taxPercent: 3,
    taxMode: "EXCLUSIVE",
    tax2Name: "BAVP",
    tax2Percent: 4,
    taxableSubtotal: 900,
    notes: null,
    footer: "Thank you for your business.",
    createdByName: null,
    issuedByName: null,
    voidReason: null,
    voidedAt: null,
    createdAt: "",
    discountType: "PERCENT",
    discountValue: 10,
    sentTo: null,
    sentByName: null,
    sentCount: 0,
    reissuedFromId: null,
    reissuedFromNumber: null,
    reissuedAs: [],
    lines: [
      {
        id: "l1",
        invoiceId: "i1",
        description: "Design development",
        milestoneId: null,
        milestoneName: null,
        quantity: null,
        unitRate: null,
        amount: 1000,
        taxable: true,
        sortOrder: 0,
      },
    ],
    payments: [payment()],
    reversedPayments: [],
    creditNotes: [],
    ...p,
  };
}

const settings = {
  bankDetails: "Aruba Bank\nAccount 123-456-78\nIBAN AW00 ARUB 0000 1234 5678",
  termsText: "Payment within 30 days.\n\nLate payment may attract interest.",
  termsOnSecondPage: true,
  termsFontSize: 8,
};

/** Every string drawn on a page, in order. */
function pageText(page: PDFPage): string {
  const contents = page.node.Contents();
  const streams: PDFRawStream[] = [];
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i += 1) {
      const s = contents.lookup(i);
      if (s instanceof PDFRawStream) streams.push(s);
    }
  } else if (contents instanceof PDFRawStream) {
    streams.push(contents);
  }
  let out = "";
  for (const s of streams) {
    const filter = s.dict.get(PDFName.of("Filter"));
    const raw = Buffer.from(s.contents);
    const body = filter && String(filter) === "/FlateDecode" ? inflateSync(raw).toString("latin1") : raw.toString("latin1");
    for (const m of body.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) out += `${Buffer.from(m[1], "hex").toString("latin1")}\n`;
  }
  return out;
}

async function read(bytes: Uint8Array): Promise<{ pages: number; text: string[] }> {
  const doc = await PDFDocument.load(bytes);
  return { pages: doc.getPageCount(), text: doc.getPages().map(pageText) };
}

describe("buildInvoicePdf", () => {
  it("is a PDF carrying the number, the discount, both taxes, the total and the balance", async () => {
    const bytes = await buildInvoicePdf({ invoice: invoice(), firm: { name: "ZenArch Studio" }, settings, t: identity });
    expect(Buffer.from(bytes.slice(0, 5)).toString("latin1")).toBe("%PDF-");
    const { pages, text } = await read(bytes);
    // T&C on a sheet of their own.
    expect(pages).toBe(2);
    const first = text[0];
    for (const fact of [
      "INV-2026-042",
      "Casa Brava N.V.",
      "Design development",
      "Discount 10%",
      "BBO 3%",
      "BAVP 4%",
      "Total",
      "Balance due",
      "PAYMENT DETAILS",
      "RCT-2026-014",
      "Please quote INV-2026-042 with your payment.",
    ]) {
      expect(first).toContain(fact);
    }
    // Amounts, whatever the locale's grouping: 963.00 total, 463.00 owed.
    expect(first).toMatch(/963\.00/);
    expect(first).toMatch(/463\.00/);
    expect(text[1]).toContain("TERMS & CONDITIONS");
    expect(text[0]).toContain("Page 1 of 2");
    expect(text[1]).toContain("Page 2 of 2");
  });

  it("breaks a long invoice onto further sheets, numbering every one", async () => {
    const lines = Array.from({ length: 90 }, (_, i) => ({
      ...invoice().lines[0],
      id: `l${i}`,
      description: `Line ${i + 1}: site supervision visit and report, including travel and photographs`,
      amount: 10,
      sortOrder: i,
    }));
    const { pages, text } = await read(
      await buildInvoicePdf({
        invoice: invoice({ lines }),
        firm: { name: "ZenArch Studio" },
        settings: { ...settings, termsText: "" },
        t: identity,
      }),
    );
    expect(pages).toBeGreaterThanOrEqual(3);
    text.forEach((page, i) => expect(page).toContain(`Page ${i + 1} of ${pages}`));
    // The table header repeats on the next sheet.
    expect(text[1]).toContain("Description");
    expect(text.join("")).toContain("Line 90:");
  });

  it("never throws on text the standard fonts cannot draw", async () => {
    const zh = (s: string) => (s === "Invoice" ? "发票" : s);
    const bytes = await buildInvoicePdf({
      invoice: invoice({ clientName: "王先生 & Co" }),
      firm: { name: "ZenArch" },
      settings,
      t: zh,
    });
    const { text } = await read(bytes);
    // The untranslatable label falls back to English; the data keeps what it can.
    expect(text[0]).toContain("INVOICE");
    expect(text[0]).toContain("?? & Co");
  });

  it("embeds a PNG logo and ignores one it cannot read", async () => {
    // 1×1 transparent PNG.
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const withLogo = await buildInvoicePdf({ invoice: invoice(), firm: { name: "Z", logoDataUrl: png }, settings, t: identity });
    const broken = await buildInvoicePdf({
      invoice: invoice(),
      firm: { name: "Z", logoDataUrl: "data:image/svg+xml;base64,PHN2Zz4=" },
      settings,
      t: identity,
    });
    expect((await PDFDocument.load(withLogo)).getPageCount()).toBe(2);
    expect((await PDFDocument.load(broken)).getPageCount()).toBe(2);
    expect(withLogo.length).toBeGreaterThan(broken.length);
    expect(pdfToBase64(withLogo).length).toBeGreaterThan(0);
  });
});

describe("buildReceiptPdf", () => {
  it("carries the receipt number, the amount, the invoice and its balance", async () => {
    const { pages, text } = await read(
      await buildReceiptPdf({ invoice: invoice(), payment: payment(), firm: { name: "ZenArch Studio" }, t: identity }),
    );
    expect(pages).toBe(1);
    for (const fact of ["RECEIPT", "RCT-2026-014", "Casa Brava N.V.", "INV-2026-042", "BANK-REF-77", "Page 1 of 1"]) {
      expect(text[0]).toContain(fact);
    }
    expect(text[0]).toMatch(/500\.00/);
    expect(text[0]).not.toContain("REVERSED");
  });

  it("says REVERSED, with the reason, on a reversed payment", async () => {
    const { text } = await read(
      await buildReceiptPdf({
        invoice: invoice(),
        payment: payment({ reversedAt: "2026-10-09T09:00:00.000Z", reverseReason: "Cheque bounced", reversedByName: "Ana" }),
        firm: { name: "ZenArch Studio" },
        t: identity,
      }),
    );
    expect(text[0]).toContain("REVERSED 09 OCT 2026: Cheque bounced");
  });
});
