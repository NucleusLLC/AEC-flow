import { describe, it, expect } from "vitest";
import {
  prepareAttachments,
  safeFilename,
  extensionOf,
  base64Bytes,
  stripDataUrl,
  formatBytes,
  attachmentLogLine,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_BYTES,
} from "@/lib/email/attachments";

/** `n` bytes of base64, padded exactly as a real encoder would pad them. */
const b64 = (bytes: number) => Buffer.alloc(bytes, 7).toString("base64");

describe("extensionOf", () => {
  it("reads the last extension, lowercased", () => {
    expect(extensionOf("Minutes.PDF")).toBe("pdf");
    expect(extensionOf("minutes.final.pdf")).toBe("pdf");
    expect(extensionOf("C:\\Users\\greg\\minutes.pdf")).toBe("pdf");
  });

  it("is empty when there is none, and for a dotfile", () => {
    expect(extensionOf("minutes")).toBe("");
    expect(extensionOf(".pdf")).toBe("");
  });
});

describe("safeFilename", () => {
  it("keeps an ordinary name and its extension", () => {
    expect(safeFilename("Villa Sabana — Minutes.pdf")).toBe("Villa Sabana — Minutes.pdf");
  });

  it("is a filename, never a path", () => {
    // A mail client that honours a path writes outside the folder the recipient
    // chose. Both separators, because the sender is on Windows.
    expect(safeFilename("../../etc/passwd.pdf")).toBe("passwd.pdf");
    expect(safeFilename("C:\\Users\\greg\\Desktop\\minutes.pdf")).toBe("minutes.pdf");
  });

  it("strips control characters — a newline in a filename is header injection", () => {
    // The newline is REMOVED rather than replaced, and the colon goes with it,
    // so what is left cannot be read as a second header by anything downstream.
    expect(safeFilename("minutes\r\nBcc: someone@example.com.pdf")).toBe(
      "minutesBcc someone@example.com.pdf",
    );
    expect(safeFilename("min\u0000utes.pdf")).toBe("minutes.pdf");
  });

  it("falls back rather than produce an empty or dot name", () => {
    expect(safeFilename("")).toBe("document.pdf");
    expect(safeFilename("   ")).toBe("document.pdf");
    expect(safeFilename("..")).toBe("document.pdf");
    expect(safeFilename("/", "x.pdf")).toBe("x.pdf");
  });

  it("caps an absurd length", () => {
    expect(safeFilename("a".repeat(400) + ".pdf").length).toBe(120);
  });
});

describe("base64Bytes", () => {
  it("counts the decoded size without decoding", () => {
    for (const n of [1, 2, 3, 100, 1023, 4096]) {
      expect(base64Bytes(b64(n))).toBe(n);
    }
  });

  it("ignores the whitespace a browser may wrap it in", () => {
    const wrapped = b64(300).replace(/(.{40})/g, "$1\n");
    expect(base64Bytes(wrapped)).toBe(300);
  });

  it("is zero for nothing", () => {
    expect(base64Bytes("")).toBe(0);
  });
});

describe("stripDataUrl", () => {
  it("removes the prefix a FileReader produces", () => {
    expect(stripDataUrl("data:application/pdf;base64,QUJD")).toBe("QUJD");
  });

  it("leaves bare base64 alone", () => {
    expect(stripDataUrl("QUJD")).toBe("QUJD");
  });
});

describe("prepareAttachments", () => {
  const pdf = { filename: "minutes.pdf", content: b64(2000) };

  it("attaches nothing when nothing was chosen", () => {
    expect(prepareAttachments()).toEqual({ ok: true, attachments: [] });
    expect(prepareAttachments([])).toEqual({ ok: true, attachments: [] });
  });

  it("takes a PDF and names its type from the extension, not the browser's claim", () => {
    const res = prepareAttachments([{ ...pdf, contentType: "application/octet-stream" }]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.attachments).toHaveLength(1);
      expect(res.attachments[0].contentType).toBe("application/pdf");
      expect(res.attachments[0].filename).toBe("minutes.pdf");
    }
  });

  it("refuses a type that is not a document, naming it", () => {
    const res = prepareAttachments([{ filename: "payload.exe", content: b64(10) }]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("payload.exe");
      expect(res.error).toContain("pdf");
    }
  });

  it("refuses a file with no extension rather than guessing", () => {
    const res = prepareAttachments([{ filename: "minutes", content: b64(10) }]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("no file extension");
  });

  it("refuses an empty file — an attachment nobody can open is worse than none", () => {
    const res = prepareAttachments([{ filename: "minutes.pdf", content: "" }]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("empty");
  });

  it("refuses one file over the per-file ceiling, with both sizes in words", () => {
    const res = prepareAttachments([
      { filename: "big.pdf", content: "x", bytes: MAX_ATTACHMENT_BYTES + 1 },
    ]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("big.pdf");
      expect(res.error).toContain(formatBytes(MAX_ATTACHMENT_BYTES));
    }
  });

  it("refuses a set that is too big together, even when each file fits", () => {
    const each = { filename: "a.pdf", content: "x", bytes: MAX_ATTACHMENT_BYTES - 1 };
    const res = prepareAttachments([each, { ...each, filename: "b.pdf" }, { ...each, filename: "c.pdf" }]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain(formatBytes(MAX_ATTACHMENTS_BYTES));
  });

  it("refuses more files than one message may carry", () => {
    const many = Array.from({ length: MAX_ATTACHMENTS + 1 }, (_, i) => ({
      filename: `f${i}.pdf`,
      content: b64(10),
    }));
    const res = prepareAttachments(many);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain(String(MAX_ATTACHMENTS));
  });

  it("refuses the WHOLE set when one file is wrong", () => {
    // Sending two of three is the outcome nobody notices: the message arrives
    // and looks fine.
    const res = prepareAttachments([pdf, { filename: "notes.docx", content: b64(10) }]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("notes.docx");
  });

  it("sanitises the name it passes on", () => {
    const res = prepareAttachments([{ filename: "..\\..\\minutes.pdf", content: b64(10) }]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.attachments[0].filename).toBe("minutes.pdf");
  });
});

describe("formatBytes", () => {
  it("reads the way a person writes a file size", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.1 * 1024 * 1024)).toBe("3.1 MB");
  });
});

describe("attachmentLogLine", () => {
  it("records what actually went with the message", () => {
    const res = prepareAttachments([{ filename: "minutes.pdf", content: b64(204800) }]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const line = attachmentLogLine(res.attachments);
      expect(line).toContain("minutes.pdf");
      expect(line).toContain("200 KB");
    }
  });

  it("says nothing when nothing was attached", () => {
    expect(attachmentLogLine([])).toBe("");
  });
});
