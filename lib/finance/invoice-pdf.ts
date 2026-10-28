/**
 * The invoice and the payment receipt as PDF files, built on the server with
 * no browser. PURE apart from pdf-lib: no Prisma, no session, no fs — the
 * caller (lib/server/invoice-documents.ts) gathers the invoice, the practice's
 * identity and its invoice settings and hands them in.
 *
 * WHY pdf-lib (pinned 1.17.1) AND NOT A RENDERER. The app's documents are
 * HTML printed by the browser, and Vercel's Node functions have no Chromium.
 * pdf-lib is plain JavaScript with no native code, no WebAssembly and no
 * fonts to ship: it writes PDF operators directly with the 14 standard PDF
 * fonts, so it runs anywhere Node runs and its output is deterministic enough
 * to unit-test. The price is that layout is done here by hand — the wrapping,
 * the page breaks and the "Page x of y" footer below — which for a one-column
 * financial document is a small, testable amount of code. @react-pdf/renderer
 * would bring a layout engine (yoga), a font stack and React reconciliation
 * into a serverless bundle to typeset a table.
 *
 * THE SAME FACTS AS THE PRINT PAGE (app/print/finance/invoices/[id]): the
 * practice's name and logo, number, dates, who it is billed to, the lines, the
 * discount, both taxes, the totals, payments received and the balance, the
 * bank details and the terms & conditions from Settings > Invoicing, and a
 * "Page x of y" footer on every sheet. It prints the STORED totals, exactly
 * as the print page does.
 *
 * CHARACTERS. The standard fonts encode WinAnsi (Western European) only.
 * Text that cannot be encoded is never allowed to throw: a label whose
 * translation needs another script (Chinese, Japanese) falls back to its
 * English key, and data (a client's name) has the characters it cannot carry
 * replaced with "?". Typographic minus, narrow spaces and similar are mapped
 * to their plain equivalents first.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { creditsOf, invoiceBalance } from "./calc";
import { termsPlacement, type InvoiceSettings } from "./invoice-settings";
import { PAYMENT_METHOD_LABEL, type InvoiceDTO, type InvoicePaymentDTO } from "./types";
import { militaryDate } from "@/lib/building-permits/register";
import { formatCurrency } from "@/lib/format";
import { fmt } from "@/lib/i18n/format";

/** The practice, as documents print it (lib/server/firm.ts). */
export type PdfFirm = {
  name: string;
  location?: string | null;
  /** A `data:image/png|jpeg;base64,…` URL. Anything else (SVG, WebP) is left off. */
  logoDataUrl?: string | null;
};

export type InvoicePdfInput = {
  invoice: InvoiceDTO;
  firm: PdfFirm;
  settings: Pick<InvoiceSettings, "bankDetails" | "termsText" | "termsOnSecondPage" | "termsFontSize">;
  /** The viewer's translator. Labels it cannot encode fall back to English. */
  t: (s: string) => string;
};

export type ReceiptPdfInput = {
  invoice: InvoiceDTO;
  payment: InvoicePaymentDTO;
  firm: PdfFirm;
  t: (s: string) => string;
};

// ── Page geometry (A4, points) ─────────────────────────────────────────────

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 50;
const MARGIN_TOP = 50;
/** Content stops here; the footer sits below it. */
const MARGIN_BOTTOM = 70;
const FOOTER_Y = 36;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

const INK = rgb(0.07, 0.07, 0.09);
const MUTED = rgb(0.42, 0.44, 0.48);
const FAINT = rgb(0.62, 0.64, 0.68);
const RULE = rgb(0.8, 0.81, 0.83);
const RED = rgb(0.75, 0.1, 0.1);

/** Characters the standard fonts lack, mapped to ones they have. */
const PLAIN: Record<string, string> = {
  "−": "-", // minus sign
  "‐": "-",
  "‑": "-",
  "‒": "-",
  "⁃": "-",
  " ": " ",
  " ": " ",
  " ": " ",
  " ": " ", // narrow no-break space (some locales' currency spacing)
  "​": "",
  "→": "->",
  "←": "<-",
  "\t": " ",
};

/** Lays out text on A4 pages and keeps the cursor; every sheet gets a footer at the end. */
class Sheet {
  readonly doc: PDFDocument;
  readonly regular: PDFFont;
  readonly bold: PDFFont;
  private readonly charset: Set<number>;
  page!: PDFPage;
  y = 0;

  private constructor(doc: PDFDocument, regular: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.regular = regular;
    this.bold = bold;
    this.charset = new Set(regular.getCharacterSet());
    this.newPage();
  }

  static async create(title: string): Promise<Sheet> {
    const doc = await PDFDocument.create();
    doc.setTitle(title);
    doc.setProducer("AEC-flow");
    doc.setCreator("AEC-flow");
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    return new Sheet(doc, regular, bold);
  }

  newPage(): void {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN_TOP;
  }

  /** Start a new sheet unless `height` still fits above the footer. */
  ensure(height: number): boolean {
    if (this.y - height < MARGIN_BOTTOM) {
      this.newPage();
      return true;
    }
    return false;
  }

  /** True when every character can be drawn (after the plain-character map). */
  encodable(s: string): boolean {
    for (const ch of this.plain(s)) if (!this.charset.has(ch.codePointAt(0) ?? 0)) return false;
    return true;
  }

  private plain(s: string): string {
    let out = "";
    for (const ch of s) out += PLAIN[ch] ?? ch;
    return out;
  }

  /** Safe to draw: mapped, and anything still unknown becomes "?". Never throws. */
  safe(s: string | null | undefined): string {
    let out = "";
    for (const ch of this.plain(String(s ?? ""))) {
      if (ch === "\n" || ch === "\r") continue;
      out += this.charset.has(ch.codePointAt(0) ?? 0) ? ch : "?";
    }
    return out;
  }

  width(s: string, size: number, font: PDFFont = this.regular): number {
    return font.widthOfTextAtSize(this.safe(s), size);
  }

  /** Word-wrap one paragraph (newlines kept) into lines no wider than `max`. */
  wrap(text: string | null | undefined, size: number, max: number, font: PDFFont = this.regular): string[] {
    const out: string[] = [];
    for (const para of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
      const words = this.safe(para).split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        out.push("");
        continue;
      }
      let line = "";
      for (const word of words) {
        const tryLine = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(tryLine, size) <= max) {
          line = tryLine;
          continue;
        }
        if (line) out.push(line);
        // A single word wider than the column (a long reference, an IBAN) is cut.
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > max && rest.length > 1) {
          let cut = rest.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > max) cut -= 1;
          out.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
      if (line) out.push(line);
    }
    return out;
  }

  text(
    s: string,
    x: number,
    y: number,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; align?: "left" | "right" } = {},
  ): void {
    const size = opts.size ?? 9;
    const font = opts.font ?? this.regular;
    const str = this.safe(s);
    if (!str) return;
    const at = opts.align === "right" ? x - font.widthOfTextAtSize(str, size) : x;
    this.page.drawText(str, { x: at, y, size, font, color: opts.color ?? INK });
  }

  rule(y: number, x1 = MARGIN_X, x2 = PAGE_W - MARGIN_X, thickness = 0.5, color = RULE): void {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  }

  /** "left · · · Page x of y" on every sheet. Called once, after everything is laid out. */
  footer(left: string, pageLabel: (page: number, pages: number) => string): void {
    const pages = this.doc.getPages();
    pages.forEach((p, i) => {
      const label = this.safe(pageLabel(i + 1, pages.length));
      const leftText = this.safe(left);
      p.drawLine({
        start: { x: MARGIN_X, y: FOOTER_Y + 12 },
        end: { x: PAGE_W - MARGIN_X, y: FOOTER_Y + 12 },
        thickness: 0.5,
        color: RULE,
      });
      if (leftText) p.drawText(leftText, { x: MARGIN_X, y: FOOTER_Y, size: 7.5, font: this.regular, color: FAINT });
      p.drawText(label, {
        x: PAGE_W - MARGIN_X - this.regular.widthOfTextAtSize(label, 7.5),
        y: FOOTER_Y,
        size: 7.5,
        font: this.regular,
        color: FAINT,
      });
    });
  }
}

/** A translated label, or its English key when the translation cannot be drawn. */
function labeller(sheet: Sheet, t: (s: string) => string): (key: string) => string {
  return (key: string) => {
    const tr = t(key);
    return sheet.encodable(tr) ? tr : key;
  };
}

/** A `data:` PNG or JPEG as an embedded image; null for anything else or a broken one. */
async function embedLogo(doc: PDFDocument, dataUrl: string | null | undefined): Promise<PDFImage | null> {
  if (!dataUrl) return null;
  const m = /^data:image\/(png|jpe?g);base64,([\s\S]+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  try {
    const bytes = Uint8Array.from(Buffer.from(m[2].replace(/\s+/g, ""), "base64"));
    return m[1].toLowerCase() === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

/** The letterhead: logo and practice on the left, the document's own block on the right. */
async function letterhead(
  sheet: Sheet,
  firm: PdfFirm,
  right: { title: string; lines: string[] },
): Promise<void> {
  const top = sheet.y;
  let x = MARGIN_X;
  const logo = await embedLogo(sheet.doc, firm.logoDataUrl);
  if (logo) {
    const scale = Math.min(120 / logo.width, 48 / logo.height, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;
    sheet.page.drawImage(logo, { x, y: top - h, width: w, height: h });
    x += w + 12;
  }
  sheet.text(firm.name, x, top - 14, { size: 14, font: sheet.bold });
  if (firm.location) sheet.text(firm.location, x, top - 28, { size: 8.5, color: MUTED });

  const rx = PAGE_W - MARGIN_X;
  sheet.text(right.title.toUpperCase(), rx, top - 12, { size: 12, font: sheet.bold, align: "right" });
  right.lines.forEach((l, i) => sheet.text(l, rx, top - 26 - i * 11, { size: 8.5, color: MUTED, align: "right" }));

  const height = Math.max(logo ? 52 : 34, 30 + right.lines.length * 11);
  sheet.y = top - height;
  sheet.rule(sheet.y, MARGIN_X, PAGE_W - MARGIN_X, 1.2, INK);
  sheet.y -= 18;
}

function moneyOf(currency: string): (n: number) => string {
  return (n: number) => formatCurrency(n, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Two stacked blocks of small label-over-value lines, side by side. */
function infoColumns(
  sheet: Sheet,
  left: { label: string; lines: string[] }[],
  right: { label: string; lines: string[] }[],
): void {
  const start = sheet.y;
  let ly = start;
  for (const b of left) {
    sheet.text(b.label, MARGIN_X, ly, { size: 7.5, color: FAINT });
    ly -= 11;
    for (const l of b.lines) {
      for (const w of sheet.wrap(l, 9, CONTENT_W / 2 - 10)) {
        sheet.text(w, MARGIN_X, ly, { size: 9 });
        ly -= 11;
      }
    }
    ly -= 4;
  }
  let ry = start;
  const rx = PAGE_W - MARGIN_X;
  for (const b of right) {
    sheet.text(b.label, rx, ry, { size: 7.5, color: FAINT, align: "right" });
    ry -= 11;
    for (const l of b.lines) {
      sheet.text(l, rx, ry, { size: 9, align: "right" });
      ry -= 11;
    }
    ry -= 4;
  }
  sheet.y = Math.min(ly, ry) - 6;
}

/** A section heading with a rule under it, kept with at least `keep` points of what follows. */
function heading(sheet: Sheet, label: string, keep = 30): void {
  sheet.ensure(18 + keep);
  sheet.text(label.toUpperCase(), MARGIN_X, sheet.y, { size: 8, font: sheet.bold, color: MUTED });
  sheet.y -= 5;
  sheet.rule(sheet.y);
  sheet.y -= 12;
}

/** Paragraphs at a given size, wrapped and broken across sheets line by line. */
function paragraphs(sheet: Sheet, text: string, size: number, color = INK): void {
  const lead = size * 1.35;
  const blocks = text.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  blocks.forEach((block, i) => {
    if (i > 0) sheet.y -= lead * 0.5;
    for (const line of sheet.wrap(block, size, CONTENT_W)) {
      sheet.ensure(lead);
      sheet.text(line, MARGIN_X, sheet.y, { size, color });
      sheet.y -= lead;
    }
  });
}

// ── The invoice ────────────────────────────────────────────────────────────

/** The invoice as a PDF (bytes). Same facts as the print page. */
export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const { invoice, firm, settings } = input;
  const sheet = await Sheet.create(`${invoice.number} · ${firm.name}`);
  const t = labeller(sheet, input.t);
  const money = moneyOf(invoice.currency);
  const { paid, credited, outstanding } = invoiceBalance({
    total: invoice.total,
    currency: invoice.currency,
    payments: invoice.payments,
    credits: creditsOf(invoice.creditNotes),
  });

  await letterhead(sheet, firm, {
    title: invoice.status === "VOID" ? t("Void invoice") : t("Invoice"),
    lines: [
      invoice.number,
      `${militaryDate(invoice.issueDate)}${invoice.status === "DRAFT" ? ` · ${t("DRAFT")}` : ""}`,
      ...(invoice.reissuedFromNumber ? [fmt(t("Replaces {number}"), { number: invoice.reissuedFromNumber })] : []),
    ],
  });

  const due = `${militaryDate(invoice.dueDate)}${
    invoice.termsDays !== null ? ` (${fmt(t("{count} days"), { count: invoice.termsDays })})` : ""
  }`;
  infoColumns(
    sheet,
    [
      {
        label: t("Billed to"),
        lines: [invoice.clientName, invoice.contactName ?? "", invoice.billingAddress ?? ""].filter(Boolean),
      },
    ],
    [
      ...(invoice.projectName ? [{ label: t("Project"), lines: [invoice.projectName] }] : []),
      ...(invoice.proposalNumber ? [{ label: t("Proposal"), lines: [invoice.proposalNumber] }] : []),
      { label: t("Due"), lines: [due] },
    ],
  );

  if (invoice.title) {
    for (const l of sheet.wrap(invoice.title, 13, CONTENT_W, sheet.bold)) {
      sheet.ensure(16);
      sheet.text(l, MARGIN_X, sheet.y, { size: 13, font: sheet.bold });
      sheet.y -= 16;
    }
    sheet.y -= 2;
  }
  if (invoice.intro) {
    paragraphs(sheet, invoice.intro, 9);
    sheet.y -= 6;
  }

  // Lines. Description wraps; the header repeats on every sheet the table reaches.
  const colQty = MARGIN_X + CONTENT_W * 0.62;
  const colRate = MARGIN_X + CONTENT_W * 0.8;
  const colAmt = PAGE_W - MARGIN_X;
  const descW = CONTENT_W * 0.55;
  const tableHead = () => {
    sheet.text(t("Description"), MARGIN_X, sheet.y, { size: 8, color: MUTED });
    sheet.text(t("Qty"), colQty, sheet.y, { size: 8, color: MUTED, align: "right" });
    sheet.text(t("Rate"), colRate, sheet.y, { size: 8, color: MUTED, align: "right" });
    sheet.text(t("Amount"), colAmt, sheet.y, { size: 8, color: MUTED, align: "right" });
    sheet.y -= 5;
    sheet.rule(sheet.y, MARGIN_X, PAGE_W - MARGIN_X, 0.7, FAINT);
    sheet.y -= 12;
  };
  sheet.ensure(40);
  sheet.y -= 4;
  tableHead();
  for (const line of invoice.lines) {
    const desc = sheet.wrap(`${line.description}${line.taxable ? "" : ` (${t("no tax")})`}`, 9, descW);
    const h = desc.length * 11 + 5;
    if (sheet.ensure(h)) tableHead();
    const top = sheet.y;
    desc.forEach((d, i) => sheet.text(d, MARGIN_X, top - i * 11, { size: 9 }));
    if (line.quantity !== null) sheet.text(String(line.quantity), colQty, top, { size: 9, color: MUTED, align: "right" });
    if (line.unitRate !== null) sheet.text(money(line.unitRate), colRate, top, { size: 9, color: MUTED, align: "right" });
    sheet.text(money(line.amount), colAmt, top, { size: 9, align: "right" });
    sheet.y = top - desc.length * 11 + 4;
    sheet.rule(sheet.y);
    sheet.y -= 11;
  }

  // Totals, right-aligned, kept together.
  const rows: { label: string; value: string; strong?: boolean; ruleAbove?: boolean }[] = [
    { label: t("Subtotal"), value: money(invoice.subtotal) },
  ];
  if (invoice.discountTotal > 0) {
    rows.push({
      label:
        invoice.discountType === "PERCENT"
          ? fmt(t("Discount {percent}%"), { percent: invoice.discountValue })
          : t("Discount"),
      value: `-${money(invoice.discountTotal)}`,
    });
  }
  const incl = invoice.taxMode === "INCLUSIVE" ? ` ${t("(included)")}` : "";
  if (invoice.taxPercent > 0) {
    rows.push({ label: `${invoice.taxName ?? t("Tax")} ${invoice.taxPercent}%${incl}`, value: money(invoice.taxTotal) });
  }
  if (invoice.tax2Percent > 0) {
    rows.push({ label: `${invoice.tax2Name ?? t("Tax")} ${invoice.tax2Percent}%${incl}`, value: money(invoice.tax2Total) });
  }
  rows.push({ label: t("Total"), value: money(invoice.total), strong: true, ruleAbove: true });
  if (paid > 0 || credited > 0) {
    if (paid > 0) rows.push({ label: t("Received"), value: `-${money(paid)}` });
    if (credited > 0) rows.push({ label: t("Credits"), value: `-${money(credited)}` });
    rows.push({ label: t("Balance due"), value: money(outstanding), strong: true, ruleAbove: true });
  }
  sheet.ensure(rows.length * 14 + 10);
  sheet.y -= 4;
  const tx = PAGE_W - MARGIN_X - 210;
  for (const r of rows) {
    if (r.ruleAbove) {
      sheet.rule(sheet.y + 10, tx, PAGE_W - MARGIN_X, 0.8, INK);
      sheet.y -= 3;
    }
    const font = r.strong ? sheet.bold : sheet.regular;
    sheet.text(r.label, tx, sheet.y, { size: r.strong ? 10 : 9, font, color: r.strong ? INK : MUTED });
    sheet.text(r.value, PAGE_W - MARGIN_X, sheet.y, { size: r.strong ? 10.5 : 9, font, align: "right" });
    sheet.y -= r.strong ? 15 : 13;
  }

  // Payment details (Settings > Invoicing), framed, kept together.
  if (settings.bankDetails.trim()) {
    const boxW = 250;
    const bx = PAGE_W - MARGIN_X - boxW;
    const body = sheet.wrap(settings.bankDetails, 8.5, boxW - 16);
    const quote = sheet.wrap(fmt(t("Please quote {number} with your payment."), { number: invoice.number }), 8, boxW - 16);
    const h = 18 + body.length * 11 + quote.length * 10 + 8;
    sheet.y -= 8;
    sheet.ensure(h);
    const top = sheet.y + 8;
    sheet.page.drawRectangle({ x: bx, y: top - h, width: boxW, height: h, borderColor: FAINT, borderWidth: 0.7 });
    let y = top - 12;
    sheet.text(t("Payment details").toUpperCase(), bx + 8, y, { size: 7.5, font: sheet.bold, color: MUTED });
    y -= 12;
    for (const l of body) {
      sheet.text(l, bx + 8, y, { size: 8.5 });
      y -= 11;
    }
    for (const l of quote) {
      sheet.text(l, bx + 8, y, { size: 8, color: MUTED });
      y -= 10;
    }
    sheet.y = top - h - 14;
  }

  if (invoice.payments.length > 0) {
    sheet.y -= 4;
    heading(sheet, t("Payments received"), invoice.payments.length > 3 ? 40 : 14 * invoice.payments.length);
    for (const p of invoice.payments) {
      sheet.ensure(13);
      sheet.text(militaryDate(p.paidAt), MARGIN_X, sheet.y, { size: 8.5, color: MUTED });
      sheet.text(t(PAYMENT_METHOD_LABEL[p.method]), MARGIN_X + 80, sheet.y, { size: 8.5, color: MUTED });
      sheet.text(p.receiptNumber ?? "", MARGIN_X + 190, sheet.y, { size: 8.5, color: MUTED });
      sheet.text(p.reference ?? "", MARGIN_X + 280, sheet.y, { size: 8.5, color: FAINT });
      sheet.text(money(p.amount), PAGE_W - MARGIN_X, sheet.y, { size: 8.5, align: "right" });
      sheet.y -= 13;
    }
  }

  const issuedCredits = invoice.creditNotes.filter((c) => c.status === "ISSUED");
  if (issuedCredits.length > 0) {
    sheet.y -= 4;
    heading(sheet, t("Credits"));
    for (const c of issuedCredits) {
      sheet.ensure(13);
      sheet.text(militaryDate(c.date), MARGIN_X, sheet.y, { size: 8.5, color: MUTED });
      sheet.text(c.number, MARGIN_X + 80, sheet.y, { size: 8.5, color: MUTED });
      sheet.text(sheet.wrap(c.reason, 8.5, 230)[0] ?? "", MARGIN_X + 170, sheet.y, { size: 8.5, color: FAINT });
      sheet.text(`-${money(c.total)}`, PAGE_W - MARGIN_X, sheet.y, { size: 8.5, align: "right" });
      sheet.y -= 13;
    }
  }

  if (invoice.footer) {
    sheet.y -= 8;
    paragraphs(sheet, invoice.footer, 8.5, MUTED);
  }

  const terms = termsPlacement(settings);
  const termsSize = settings.termsFontSize;
  if (terms === "inline") {
    sheet.y -= 8;
    heading(sheet, t("Terms & conditions"));
    paragraphs(sheet, settings.termsText, termsSize);
  }

  if (invoice.status === "VOID") {
    sheet.y -= 10;
    sheet.ensure(14);
    const msg = invoice.voidReason
      ? fmt(t("This invoice has been voided: {reason}."), { reason: invoice.voidReason })
      : t("This invoice has been voided.");
    for (const l of sheet.wrap(msg.toUpperCase(), 9, CONTENT_W, sheet.bold)) {
      sheet.ensure(12);
      sheet.text(l, MARGIN_X, sheet.y, { size: 9, font: sheet.bold, color: RED });
      sheet.y -= 12;
    }
  }

  if (terms === "second-page") {
    sheet.newPage();
    sheet.text(t("Terms & conditions").toUpperCase(), MARGIN_X, sheet.y, { size: 11, font: sheet.bold });
    sheet.y -= 6;
    sheet.rule(sheet.y, MARGIN_X, PAGE_W - MARGIN_X, 1.2, INK);
    sheet.y -= 12;
    sheet.text(`${firm.name} · ${invoice.number}`, MARGIN_X, sheet.y, { size: 8, color: MUTED });
    sheet.y -= 16;
    paragraphs(sheet, settings.termsText, termsSize);
  }

  sheet.footer(`${firm.name} · ${invoice.number} · ${money(invoice.total)} ${invoice.currency}`, (page, pages) =>
    fmt(t("Page {page} of {pages}"), { page, pages }),
  );
  return sheet.doc.save();
}

// ── The receipt ────────────────────────────────────────────────────────────

/**
 * A payment receipt as a PDF: RCT number, who paid, how much, how, against
 * which invoice, and what that invoice still owes. A reversed payment's
 * receipt says REVERSED, with the reason, in red across the top.
 */
export async function buildReceiptPdf(input: ReceiptPdfInput): Promise<Uint8Array> {
  const { invoice, payment, firm } = input;
  const number = payment.receiptNumber ?? payment.id;
  const sheet = await Sheet.create(`${number} · ${firm.name}`);
  const t = labeller(sheet, input.t);
  const money = moneyOf(invoice.currency);
  const { outstanding } = invoiceBalance({
    total: invoice.total,
    currency: invoice.currency,
    payments: invoice.payments,
    credits: creditsOf(invoice.creditNotes),
  });

  await letterhead(sheet, firm, {
    title: t("Receipt"),
    lines: [number, militaryDate(payment.paidAt)],
  });

  if (payment.reversedAt) {
    const msg = payment.reverseReason
      ? fmt(t("REVERSED {date}: {reason}"), { date: militaryDate(payment.reversedAt), reason: payment.reverseReason })
      : fmt(t("REVERSED {date}"), { date: militaryDate(payment.reversedAt) });
    const lines = sheet.wrap(msg, 10, CONTENT_W - 16, sheet.bold);
    const h = lines.length * 13 + 12;
    sheet.page.drawRectangle({
      x: MARGIN_X,
      y: sheet.y - h + 10,
      width: CONTENT_W,
      height: h,
      borderColor: RED,
      borderWidth: 1.2,
    });
    let y = sheet.y - 4;
    for (const l of lines) {
      sheet.text(l, MARGIN_X + 8, y, { size: 10, font: sheet.bold, color: RED });
      y -= 13;
    }
    sheet.y -= h + 8;
    sheet.text(t("This payment was reversed and does not count towards the invoice."), MARGIN_X, sheet.y, {
      size: 8.5,
      color: MUTED,
    });
    sheet.y -= 18;
  }

  infoColumns(
    sheet,
    [
      {
        label: t("Received from"),
        lines: [invoice.clientName, invoice.contactName ?? "", invoice.billingAddress ?? ""].filter(Boolean),
      },
    ],
    [
      ...(invoice.projectName ? [{ label: t("Project"), lines: [invoice.projectName] }] : []),
      { label: t("For invoice"), lines: [invoice.number] },
    ],
  );

  const facts: [string, string][] = [
    [t("Receipt number"), number],
    [t("Received on"), militaryDate(payment.paidAt)],
    [t("Method"), t(PAYMENT_METHOD_LABEL[payment.method])],
    [t("Reference"), payment.reference ?? "—"],
    [t("Invoice"), invoice.number],
    [t("Invoice total"), money(invoice.total)],
    [t("Balance due"), money(outstanding)],
  ];
  sheet.y -= 4;
  for (const [k, v] of facts) {
    sheet.text(k, MARGIN_X, sheet.y, { size: 9, color: MUTED });
    sheet.text(v, MARGIN_X + 150, sheet.y, { size: 9 });
    sheet.y -= 6;
    sheet.rule(sheet.y);
    sheet.y -= 11;
  }

  sheet.y -= 10;
  sheet.text(t("Amount received"), MARGIN_X, sheet.y, { size: 11, font: sheet.bold });
  sheet.text(money(payment.amount), PAGE_W - MARGIN_X, sheet.y, {
    size: 14,
    font: sheet.bold,
    align: "right",
    color: payment.reversedAt ? FAINT : INK,
  });
  if (payment.reversedAt) {
    const w = sheet.width(money(payment.amount), 14, sheet.bold);
    sheet.rule(sheet.y + 5, PAGE_W - MARGIN_X - w, PAGE_W - MARGIN_X, 1, RED);
  }
  sheet.y -= 26;
  if (payment.recordedByName) {
    sheet.text(fmt(t("Recorded by {name}"), { name: payment.recordedByName }), MARGIN_X, sheet.y, {
      size: 8,
      color: FAINT,
    });
  }

  sheet.footer(`${firm.name} · ${number}`, (page, pages) => fmt(t("Page {page} of {pages}"), { page, pages }));
  return sheet.doc.save();
}

/** Bytes → base64 for an email attachment (lib/email/attachments.ts takes base64). */
export function pdfToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
