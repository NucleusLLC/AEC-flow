import { describe, it, expect } from "vitest";
import { parseAddress, parseAddressList, MAX_CC, MAX_ADDRESS_LENGTH } from "@/lib/email/recipients";

/**
 * Recipient validation is the gate that decides whether a send is attempted at
 * all, and the layer where "silently dropped" would be indistinguishable from
 * "delivered". Both halves of that are asserted: the shapes it must accept
 * (because refusing a real address reads as the button being broken again), and
 * the shapes it must REFUSE OUT LOUD rather than quietly discard.
 */

describe("parseAddress", () => {
  it("accepts the addresses people actually have", () => {
    for (const a of [
      "greg@aec-flow.com",
      "first.last@sub.domain.co.uk",
      "user+schedule@gmail.com",
      "j_l-99@taxatie-bureau.com",
    ]) {
      expect(parseAddress(a), a).toEqual({ ok: true, address: a });
    }
  });

  it("unwraps a display name, which is what a paste from a mail client looks like", () => {
    expect(parseAddress("Jozef Laclé <jozef@taxatie-bureau.com>")).toEqual({
      ok: true,
      address: "jozef@taxatie-bureau.com",
    });
    expect(parseAddress("  <a@b.com>  ")).toEqual({ ok: true, address: "a@b.com" });
  });

  it("trims surrounding whitespace", () => {
    expect(parseAddress("  greg@aec-flow.com \n")).toEqual({ ok: true, address: "greg@aec-flow.com" });
  });

  it("refuses an empty recipient with the field's own name", () => {
    expect(parseAddress("", "Recipient")).toEqual({ ok: false, error: "Recipient is required." });
    expect(parseAddress("   ", "Cc")).toEqual({ ok: false, error: "Cc is required." });
  });

  it("refuses what is not an address", () => {
    for (const a of [
      "greg",
      "greg@",
      "@aec-flow.com",
      "greg@localhost", // no dot in the domain — no client mailbox looks like this
      "greg @aec-flow.com",
      "greg@aec flow.com",
      "greg@@aec-flow.com",
      "a@b..com",
      "<a@b.com", // half a display-name wrapper
    ]) {
      const res = parseAddress(a);
      expect(res.ok, `${a} should be refused`).toBe(false);
    }
  });

  it("names the offending text in the error, so the user can see what to fix", () => {
    const res = parseAddress("clietn@@example.com");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("clietn@@example.com");
  });

  it("refuses an over-long address instead of handing it to the provider", () => {
    const long = `${"a".repeat(MAX_ADDRESS_LENGTH)}@example.com`;
    const res = parseAddress(long);
    expect(res).toEqual({ ok: false, error: "Recipient address is too long." });
  });

  it("refuses an address carrying list punctuation, which would smuggle a second recipient", () => {
    expect(parseAddress("a@b.com,c@d.com").ok).toBe(false);
    expect(parseAddress("a@b.com;c@d.com").ok).toBe(false);
  });
});

describe("parseAddressList", () => {
  it("treats empty as an empty list, not an error — cc is optional", () => {
    expect(parseAddressList("")).toEqual({ ok: true, addresses: [] });
    expect(parseAddressList("   ")).toEqual({ ok: true, addresses: [] });
    expect(parseAddressList(null)).toEqual({ ok: true, addresses: [] });
    expect(parseAddressList(undefined)).toEqual({ ok: true, addresses: [] });
  });

  it("splits on commas, semicolons and newlines", () => {
    expect(parseAddressList("a@b.com, c@d.com; e@f.com\ng@h.com")).toEqual({
      ok: true,
      addresses: ["a@b.com", "c@d.com", "e@f.com", "g@h.com"],
    });
  });

  it("REFUSES the whole list when one entry is bad — it does not send to the rest", () => {
    // The failure this guards: three people are copied, two are, and the sender
    // is told it worked. Silence about a dropped recipient is the same class of
    // bug as the green tick this module replaced.
    const res = parseAddressList("good@example.com, not-an-address, also@example.com");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("not-an-address");
  });

  it("collapses duplicates case-insensitively", () => {
    expect(parseAddressList("A@B.com, a@b.com, c@d.com")).toEqual({
      ok: true,
      addresses: ["A@B.com", "c@d.com"],
    });
  });

  it("caps the blast radius of a pasted spreadsheet column", () => {
    const many = Array.from({ length: MAX_CC + 1 }, (_, i) => `p${i}@example.com`).join(",");
    const res = parseAddressList(many);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain(String(MAX_CC));
    // Exactly at the limit is fine.
    const atLimit = Array.from({ length: MAX_CC }, (_, i) => `p${i}@example.com`).join(",");
    expect(parseAddressList(atLimit).ok).toBe(true);
  });

  it("ignores trailing separators rather than reading them as empty recipients", () => {
    expect(parseAddressList("a@b.com,")).toEqual({ ok: true, addresses: ["a@b.com"] });
    expect(parseAddressList(",a@b.com,,")).toEqual({ ok: true, addresses: ["a@b.com"] });
  });
});
