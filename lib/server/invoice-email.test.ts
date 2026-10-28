/**
 * The one rule lib/server/invoice-email.ts adds to the email path: an invoice
 * is stamped SENT only when the provider CONFIRMED the send (`ok: true`, which
 * document-email returns only with a message id). Every failure — no API key,
 * a refused recipient, an unconfirmed send, a draft — leaves it unstamped.
 *
 * The edges are injected, so no provider, no database and no session.
 */
import { describe, expect, it, vi } from "vitest";

// The module's default edges reach Prisma, the session and the provider; none
// of them may load in a unit test, so each is stubbed at its import.
vi.mock("@/lib/server/actor", () => ({ requireActor: vi.fn() }));
vi.mock("@/lib/server/firm", () => ({ getFirmIdentity: vi.fn() }));
vi.mock("@/lib/server/practice-config", () => ({ getInvoiceSettings: vi.fn(), getPracticeSettings: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getServerT: vi.fn() }));
vi.mock("@/lib/server/document-email", () => ({ sendDocumentEmail: vi.fn() }));
vi.mock("@/lib/data/invoices", () => {
  class InvoiceActionError extends Error {}
  class InvoiceNotFoundError extends Error {}
  return {
    getInvoice: vi.fn(),
    getReceipt: vi.fn(),
    markInvoiceSent: vi.fn(),
    requireSendableInvoice: vi.fn(),
    InvoiceActionError,
    InvoiceNotFoundError,
  };
});

import { emailInvoice, type InvoiceEmailDeps } from "./invoice-email";
import { InvoiceActionError } from "@/lib/data/invoices";
import type { SendDocumentEmailResult } from "./document-email";

const MESSAGE = { to: "a@example.com, b@example.com", subject: "Invoice INV-1", body: "Please find attached." };

function deps(result: SendDocumentEmailResult, over: Partial<InvoiceEmailDeps> = {}) {
  const d = {
    requireSendable: vi.fn(async () => {}),
    render: vi.fn(async () => ({ filename: "INV-1.pdf", bytes: new Uint8Array([37, 80, 68, 70]) })),
    send: vi.fn(async () => result),
    markSent: vi.fn(async () => {}),
    ...over,
  };
  return d;
}

describe("emailInvoice", () => {
  it("attaches the generated PDF and stamps SENT on a confirmed send", async () => {
    const d = deps({
      ok: true,
      messageId: "re_123",
      to: "a@example.com, b@example.com",
      recipients: ["a@example.com", "b@example.com"],
      attachments: ["INV-1.pdf"],
      cc: [],
      logId: "log1",
    });
    const res = await emailInvoice("inv1", MESSAGE, d as unknown as InvoiceEmailDeps);
    expect(res.ok).toBe(true);
    const sent = (d.send as unknown as { mock: { calls: unknown[][] } }).mock.calls[0] as [Record<string, unknown>];
    expect(sent[0]).toMatchObject({
      to: MESSAGE.to,
      relatedType: "invoice",
      relatedId: "inv1",
      attachments: [{ filename: "INV-1.pdf", content: Buffer.from("%PDF").toString("base64"), contentType: "application/pdf" }],
    });
    expect(d.markSent).toHaveBeenCalledWith("inv1", "a@example.com, b@example.com");
  });

  it.each([
    ["not_configured", "Email is not configured on this server, so nothing was sent."],
    ["invalid_recipient", "That is not an email address."],
    ["unconfirmed", "The provider accepted the message but returned no id."],
    ["provider_error", "Refused."],
  ] as const)("does NOT stamp SENT when the send fails (%s)", async (reason, error) => {
    const d = deps({ ok: false, reason, error, logId: "log2" });
    const res = await emailInvoice("inv1", MESSAGE, d as unknown as InvoiceEmailDeps);
    expect(res).toMatchObject({ ok: false, reason });
    expect(d.markSent).not.toHaveBeenCalled();
  });

  it("refuses a draft or a void before building anything", async () => {
    const d = deps(
      { ok: false, reason: "provider_error", error: "", logId: null },
      {
        requireSendable: vi.fn(async () => {
          throw new InvoiceActionError("Issue the invoice before emailing it.");
        }),
      },
    );
    const res = await emailInvoice("inv1", MESSAGE, d as unknown as InvoiceEmailDeps);
    expect(res).toMatchObject({ ok: false, error: "Issue the invoice before emailing it." });
    expect(d.render).not.toHaveBeenCalled();
    expect(d.send).not.toHaveBeenCalled();
    expect(d.markSent).not.toHaveBeenCalled();
  });
});
