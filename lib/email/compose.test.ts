import { describe, it, expect } from "vitest";
import { renderDocumentEmail, escapeHtml, NOT_ATTACHED, LINK_NOTE } from "@/lib/email/compose";

const base = {
  body: "Dear Ms Vega,\n\nThe programme is ready.",
  documentName: "Villa Verde — Schedule.pdf",
  senderName: "Greg Laclé",
  firmName: "ZenArch Consultants",
};

describe("renderDocumentEmail", () => {
  it("carries the sender's own words into both parts", () => {
    const { html, text } = renderDocumentEmail(base);
    expect(html).toContain("Dear Ms Vega,");
    expect(html).toContain("The programme is ready.");
    expect(text).toContain("Dear Ms Vega,");
    expect(text).toContain("The programme is ready.");
  });

  it("names the document AND says it is not attached", () => {
    // The whole point. Naming a file while implying it is enclosed is the same
    // lie as reporting a send that did not happen.
    const { html, text } = renderDocumentEmail(base);
    expect(html).toContain("Villa Verde");
    expect(html).toContain(escapeHtml(NOT_ATTACHED));
    expect(text).toContain("Document: Villa Verde — Schedule.pdf");
    expect(text).toContain(NOT_ATTACHED);
  });

  it("signs with the sender and the practice, both resolved server-side", () => {
    const { html, text } = renderDocumentEmail(base);
    expect(html).toContain("Greg Laclé · ZenArch Consultants");
    expect(text).toContain("Greg Laclé · ZenArch Consultants");
  });

  it("includes a link only when one is given, and marks it sign-in-only", () => {
    const without = renderDocumentEmail(base);
    expect(without.html).not.toContain(LINK_NOTE);
    expect(without.text).not.toContain(LINK_NOTE);

    const withLink = renderDocumentEmail({ ...base, link: "https://aec-flow.com/print/schedule/abc" });
    expect(withLink.text).toContain(LINK_NOTE);
    expect(withLink.text).toContain("https://aec-flow.com/print/schedule/abc");
    expect(withLink.html).toContain('href="https://aec-flow.com/print/schedule/abc"');
    // Stated, not implied: every document route is auth-gated.
    expect(LINK_NOTE.toLowerCase()).toContain("sign-in required");
  });

  it("escapes what the user typed — the body is not a template", () => {
    const { html } = renderDocumentEmail({
      ...base,
      body: 'Budget <script>alert("x")</script> & "quotes"',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("escapes a document name too — it comes from a project's own text", () => {
    const { html } = renderDocumentEmail({ ...base, documentName: "<b>Villa</b> & Co.pdf" });
    expect(html).not.toContain("<b>Villa</b>");
    expect(html).toContain("&lt;b&gt;Villa&lt;/b&gt;");
  });

  it("turns blank lines into paragraphs and single newlines into breaks", () => {
    const { html } = renderDocumentEmail({ ...base, body: "One\nstill one\n\nTwo" });
    expect((html.match(/<p style="margin:0 0 16px/g) ?? []).length).toBe(2);
    expect(html).toContain("One<br>still one");
  });

  it("survives an empty body and an empty document name without emitting junk", () => {
    const { html, text } = renderDocumentEmail({ ...base, body: "", documentName: "" });
    expect(text).not.toContain("Document:");
    expect(text).not.toContain(NOT_ATTACHED);
    expect(html).not.toContain("undefined");
    expect(text).not.toContain("undefined");
  });
});

describe("escapeHtml", () => {
  it("covers every character that can break out of a text node or an attribute", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  it("escapes the ampersand first, so entities are not double-decoded", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });
});
