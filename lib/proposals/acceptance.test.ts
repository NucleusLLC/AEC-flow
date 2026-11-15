import { describe, expect, it } from "vitest";
import {
  ACCEPTANCE_ERRORS,
  ACCEPTANCE_LINK_TTL_DAYS,
  CLIENT_ACCEPTABLE_STATUSES,
  acceptanceLinkExpiry,
  acceptanceLinkState,
  acceptanceUrl,
  canApplyDecision,
  clipHeader,
  decisionHistoryReason,
  decisionTargetStatus,
  generateAcceptanceToken,
  hashAcceptanceToken,
  isClientAcceptable,
  isRevocable,
  isWellFormedAcceptanceToken,
  parseAcceptanceForm,
  parseDeclineForm,
  proposalLanguage,
  signatureMatchesName,
  type AcceptanceLinkFacts,
  type ProposalFacts,
} from "./acceptance";
import { withAcceptanceLink } from "./acceptance-email";
import { STATUS_LABEL, canTransition, type ServiceProposalStatus } from "./engine/status";

const NOW = new Date("2026-11-14T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("acceptance token", () => {
  it("is 32 random bytes in base64url (43 chars) and well-formed", () => {
    const t = generateAcceptanceToken();
    expect(t).toHaveLength(43);
    expect(isWellFormedAcceptanceToken(t)).toBe(true);
    expect(generateAcceptanceToken()).not.toBe(t);
  });

  it("uses the injected random source", () => {
    const t = generateAcceptanceToken((n) => Buffer.alloc(n, 0));
    expect(t).toBe(Buffer.alloc(32, 0).toString("base64url"));
  });

  it("stores only a sha256 hex digest, stable for the same token", () => {
    const t = generateAcceptanceToken();
    const h = hashAcceptanceToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashAcceptanceToken(t)).toBe(h);
    expect(h).not.toContain(t);
  });

  it("rejects anything not shaped like an issued token", () => {
    for (const bad of [undefined, null, 42, "", "short", "a".repeat(42), "a".repeat(44), "a".repeat(42) + "=", "../" + "a".repeat(40)]) {
      expect(isWellFormedAcceptanceToken(bad)).toBe(false);
    }
  });

  it("builds the public link from configuration, never the request", () => {
    expect(acceptanceUrl({ NEXTAUTH_URL: "https://aec-flow.com/" }, "tok")).toBe("https://aec-flow.com/p/tok");
    expect(acceptanceUrl({ NEXT_PUBLIC_APP_URL: "https://x.test" }, "tok")).toBe("https://x.test/p/tok");
    expect(acceptanceUrl({}, "tok")).toBe("https://aec-flow.com/p/tok");
  });
});

describe("which statuses a client may answer", () => {
  it("is exactly SENT and UNDER_CLIENT_REVIEW", () => {
    expect([...CLIENT_ACCEPTABLE_STATUSES].sort()).toEqual(["SENT", "UNDER_CLIENT_REVIEW"]);
    for (const s of Object.keys(STATUS_LABEL) as ServiceProposalStatus[]) {
      expect(isClientAcceptable(s)).toBe(s === "SENT" || s === "UNDER_CLIENT_REVIEW");
    }
  });

  it("maps accept to ACCEPTED and decline to REJECTED", () => {
    expect(decisionTargetStatus("ACCEPTED")).toBe("ACCEPTED");
    expect(decisionTargetStatus("DECLINED")).toBe("REJECTED");
  });

  it("agrees with the status machine: both answers are legal from every acceptable status", () => {
    for (const s of CLIENT_ACCEPTABLE_STATUSES) {
      expect(canTransition(s, "ACCEPTED")).toBe(true);
      expect(canTransition(s, "REJECTED")).toBe(true);
      expect(canApplyDecision(s, "ACCEPTED")).toBe(true);
      expect(canApplyDecision(s, "DECLINED")).toBe(true);
    }
  });

  it("never applies an answer to a locked or finished proposal", () => {
    for (const s of ["ACCEPTED", "PARTIALLY_ACCEPTED", "CONVERTED", "SUPERSEDED", "WITHDRAWN", "REJECTED", "EXPIRED", "DRAFT"] as const) {
      expect(canApplyDecision(s, "ACCEPTED")).toBe(false);
      expect(canApplyDecision(s, "DECLINED")).toBe(false);
    }
  });
});

describe("link expiry", () => {
  it("defaults to 30 days", () => {
    expect(ACCEPTANCE_LINK_TTL_DAYS).toBe(30);
    expect(acceptanceLinkExpiry(NOW)!.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it("stops at the end of the validity day when that comes first", () => {
    expect(acceptanceLinkExpiry(NOW, "2026-11-20")!.toISOString()).toBe("2026-11-20T23:59:59.999Z");
  });

  it("keeps 30 days when the validity date is further out", () => {
    expect(acceptanceLinkExpiry(NOW, "2027-03-01")!.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });

  it("refuses a link for an offer that has already lapsed", () => {
    expect(acceptanceLinkExpiry(NOW, "2026-11-13")).toBeNull();
  });

  it("ignores an unreadable validity date", () => {
    expect(acceptanceLinkExpiry(NOW, "soon")!.getTime()).toBe(NOW.getTime() + 30 * DAY);
  });
});

describe("link state", () => {
  const link = (over: Partial<AcceptanceLinkFacts> = {}): AcceptanceLinkFacts => ({
    expiresAt: new Date(NOW.getTime() + DAY),
    revokedAt: null,
    decision: null,
    revision: 1,
    versionLabel: "1.0",
    ...over,
  });
  const proposal = (over: Partial<ProposalFacts> = {}): ProposalFacts => ({
    status: "SENT",
    revision: 1,
    versionLabel: "1.0",
    deletedAt: null,
    ...over,
  });

  it("is open for an unanswered, live link on a proposal awaiting the client", () => {
    expect(acceptanceLinkState(link(), proposal(), NOW)).toBe("open");
    expect(acceptanceLinkState(link(), proposal({ status: "UNDER_CLIENT_REVIEW" }), NOW)).toBe("open");
  });

  it("is invalid — the same answer — for unknown, revoked and expired links", () => {
    expect(acceptanceLinkState(null, proposal(), NOW)).toBe("invalid");
    expect(acceptanceLinkState(link({ revokedAt: NOW }), proposal(), NOW)).toBe("invalid");
    expect(acceptanceLinkState(link({ expiresAt: NOW }), proposal(), NOW)).toBe("invalid");
  });

  it("dies when the proposal leaves the acceptable statuses", () => {
    for (const s of ["REVISION_REQUESTED", "SUPERSEDED", "WITHDRAWN", "EXPIRED", "DRAFT", "ACCEPTED"] as const) {
      expect(acceptanceLinkState(link(), proposal({ status: s }), NOW)).toBe("invalid");
    }
  });

  it("dies when the proposal was deleted, revised or re-versioned", () => {
    expect(acceptanceLinkState(link(), null, NOW)).toBe("invalid");
    expect(acceptanceLinkState(link(), proposal({ deletedAt: NOW }), NOW)).toBe("invalid");
    expect(acceptanceLinkState(link(), proposal({ revision: 2 }), NOW)).toBe("invalid");
    expect(acceptanceLinkState(link(), proposal({ versionLabel: "2.0" }), NOW)).toBe("invalid");
  });

  it("stays readable once answered, even after expiry and a later status change", () => {
    const answered = link({ decision: "ACCEPTED", expiresAt: new Date(NOW.getTime() - DAY) });
    expect(acceptanceLinkState(answered, proposal({ status: "CONVERTED" }), NOW)).toBe("decided");
    expect(acceptanceLinkState(link({ decision: "DECLINED" }), proposal({ status: "REJECTED" }), NOW)).toBe("decided");
  });

  it("a revoked answered link is invalid too, and junk in decision is not a decision", () => {
    expect(acceptanceLinkState(link({ decision: "ACCEPTED", revokedAt: NOW }), proposal(), NOW)).toBe("invalid");
    expect(acceptanceLinkState(link({ decision: "MAYBE" }), proposal(), NOW)).toBe("invalid");
  });

  it("only an open, unexpired link can be revoked", () => {
    expect(isRevocable(link(), NOW)).toBe(true);
    expect(isRevocable(link({ decision: "ACCEPTED" }), NOW)).toBe(false);
    expect(isRevocable(link({ revokedAt: NOW }), NOW)).toBe(false);
    expect(isRevocable(link({ expiresAt: NOW }), NOW)).toBe(false);
  });
});

describe("the acceptance form", () => {
  const good = { name: "  Maria   de Kort ", title: "Director", company: "", onBehalf: "on", signature: "maria de kort" };

  it("accepts a complete form and normalises it", () => {
    const r = parseAcceptanceForm(good);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual({ name: "Maria de Kort", title: "Director", company: null, onBehalf: true, signature: "maria de kort" });
  });

  it("requires a name", () => {
    const r = parseAcceptanceForm({ ...good, name: " " , signature: " " });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.name).toBe(ACCEPTANCE_ERRORS.name);
  });

  it("requires the on-behalf box to be ticked", () => {
    for (const onBehalf of [undefined, "", "off", false]) {
      const r = parseAcceptanceForm({ ...good, onBehalf });
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.issues.onBehalf).toBe(ACCEPTANCE_ERRORS.onBehalf);
    }
  });

  it("requires the typed signature to be the signer's own name", () => {
    const r = parseAcceptanceForm({ ...good, signature: "Someone Else" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.signature).toBe(ACCEPTANCE_ERRORS.signatureMismatch);
    expect(signatureMatchesName(" MARIA  DE KORT", "Maria de Kort")).toBe(true);
  });

  it("bounds every field", () => {
    const long = "x".repeat(200);
    const r = parseAcceptanceForm({ ...good, title: long, company: "y".repeat(161) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.title).toBe(ACCEPTANCE_ERRORS.titleLong);
    expect(r.issues.company).toBe(ACCEPTANCE_ERRORS.companyLong);
  });
});

describe("the decline form", () => {
  it("needs nothing, and keeps an optional reason", () => {
    expect(parseDeclineForm({})).toEqual({ ok: true, value: { name: null, reason: null } });
    expect(parseDeclineForm({ name: "Jan", reason: "  Over budget. " })).toEqual({
      ok: true,
      value: { name: "Jan", reason: "Over budget." },
    });
  });

  it("bounds the reason", () => {
    const r = parseDeclineForm({ reason: "x".repeat(2001) });
    expect(r.ok).toBe(false);
  });
});

describe("helpers", () => {
  it("clips caller-controlled headers", () => {
    expect(clipHeader(null, 10)).toBeNull();
    expect(clipHeader("   ", 10)).toBeNull();
    expect(clipHeader("abcdefghijklmnop", 5)).toBe("abcde");
  });

  it("writes a readable history line", () => {
    expect(decisionHistoryReason("ACCEPTED", { name: "Maria", title: "Director", company: "ACME" }, "1.0")).toBe(
      "Accepted by the client through the acceptance link v1.0: Maria (Director, ACME).",
    );
    expect(decisionHistoryReason("DECLINED", { name: "" }, null, "Too dear")).toBe(
      "Declined by the client through the acceptance link. Reason: Too dear",
    );
  });
});

describe("the proposal email with the link", () => {
  it("puts the link straight after the subject line and keeps the rest", () => {
    const body = ["SERVICE PROPOSAL SP-1 — Villa", "", "Client:      ACME", "", "Kind regards,", "Studio"].join("\n");
    const out = withAcceptanceLink(body, "https://aec-flow.com/p/tok", "2026-12-14");
    expect(out.split("\n")).toEqual([
      "SERVICE PROPOSAL SP-1 — Villa",
      "",
      "You can read this proposal and accept or decline it online — no account needed:",
      "https://aec-flow.com/p/tok",
      "The link works until 2026-12-14.",
      "",
      "Client:      ACME",
      "",
      "Kind regards,",
      "Studio",
    ]);
  });

  it("appends when the body has no blank line", () => {
    expect(withAcceptanceLink("Hi", "u", null).split("\n")).toEqual([
      "Hi",
      "",
      "You can read this proposal and accept or decline it online — no account needed:",
      "u",
    ]);
  });
});

describe("the public page language", () => {
  it("follows the proposal, else English", () => {
    expect(proposalLanguage("nl")).toBe("nl");
    expect(proposalLanguage(" ES ")).toBe("es");
    expect(proposalLanguage("pt-BR")).toBe("pt");
    expect(proposalLanguage("pap")).toBe("en");
    expect(proposalLanguage(null)).toBe("en");
  });
});
