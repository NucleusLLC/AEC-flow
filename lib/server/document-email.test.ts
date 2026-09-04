import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * THE SEND ORCHESTRATION — the module whose only real failure mode is telling a
 * user something went out when it did not.
 *
 * WHAT IS MOCKED, AND WHY THERE. Four module edges, all of them I/O:
 *
 *   @/lib/server/email    — the Resend wrapper. Mocked at the `sendEmail` boundary
 *                           the brief names, so every provider outcome (no API
 *                           key, unverified domain, rejected recipient, accepted
 *                           with an id, accepted WITHOUT an id) is a value in a
 *                           test rather than a state of production. This also
 *                           keeps `import "server-only"` out of the graph — Next
 *                           supplies that module, and it does not resolve here.
 *   @/lib/data/email-log  — the record. Mocked so each test can read exactly what
 *                           would have been written for that outcome.
 *   @/lib/server/actor    — the session. Mocked to a fixed actor; the point being
 *                           tested is that the sender comes from HERE and never
 *                           from the input.
 *   @/lib/server/firm     — the practice profile (Prisma + session).
 *
 * `lib/email/recipients` and `lib/email/compose` are deliberately NOT mocked:
 * they are pure, and the interesting question is what this module does with
 * their real answers.
 */

const mocks = vi.hoisted(() => ({
  requireActor: vi.fn(),
  getFirmIdentity: vi.fn(),
  sendEmail: vi.fn(),
  recordEmailAttempt: vi.fn(),
}));

vi.mock("@/lib/server/actor", () => ({ requireActor: mocks.requireActor }));
vi.mock("@/lib/server/firm", () => ({ getFirmIdentity: mocks.getFirmIdentity }));
vi.mock("@/lib/server/email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/data/email-log", () => ({ recordEmailAttempt: mocks.recordEmailAttempt }));

import { sendDocumentEmail, classify } from "@/lib/server/document-email";

const ACTOR = {
  id: "usr_1",
  name: "Greg Laclé",
  email: "greg@aec-flow.com",
  role: "DIRECTOR",
  companyId: "cmp_zenarch",
  isFounder: true,
};

const INPUT = {
  to: "client@example.com",
  cc: "",
  subject: "Programme — Villa Verde",
  body: "Dear Ms Vega,\n\nThe programme is attached below.",
  documentName: "Villa Verde — Schedule.pdf",
  relatedType: "schedule",
  relatedId: "ZA-2026-014",
};

/** The single argument `recordEmailAttempt` was called with. */
function loggedAttempt(call = 0) {
  return mocks.recordEmailAttempt.mock.calls[call][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireActor.mockResolvedValue(ACTOR);
  mocks.getFirmIdentity.mockResolvedValue({ name: "ZenArch Consultants", location: "", logo: null });
  mocks.recordEmailAttempt.mockResolvedValue("log_1");
});

describe("a confirmed send", () => {
  it("reports success only with the provider's message id, and names the recipient", async () => {
    mocks.sendEmail.mockResolvedValue({ ok: true, id: "re_abc123" });
    const res = await sendDocumentEmail(INPUT);
    expect(res).toEqual({
      ok: true,
      messageId: "re_abc123",
      to: "client@example.com",
      cc: [],
      logId: "log_1",
    });
  });

  it("records it as SENT with the provider id and no error", async () => {
    mocks.sendEmail.mockResolvedValue({ ok: true, id: "re_abc123" });
    await sendDocumentEmail(INPUT);
    expect(mocks.recordEmailAttempt).toHaveBeenCalledTimes(1);
    expect(loggedAttempt()).toMatchObject({
      status: "SENT",
      providerMessageId: "re_abc123",
      error: null,
      to: "client@example.com",
      relatedType: "schedule",
      relatedId: "ZA-2026-014",
      documentName: "Villa Verde — Schedule.pdf",
    });
  });

  it("passes the validated cc list to the provider and echoes it back", async () => {
    mocks.sendEmail.mockResolvedValue({ ok: true, id: "re_1" });
    const res = await sendDocumentEmail({ ...INPUT, cc: "greg@aec-flow.com; office@zenarch.com" });
    expect(mocks.sendEmail.mock.calls[0][0].cc).toEqual(["greg@aec-flow.com", "office@zenarch.com"]);
    expect(res.ok && res.cc).toEqual(["greg@aec-flow.com", "office@zenarch.com"]);
    expect(loggedAttempt().cc).toEqual(["greg@aec-flow.com", "office@zenarch.com"]);
  });

  it("still reports the send, but flags it, when the record could not be written", async () => {
    // A logging failure must not turn a delivered email into a reported error —
    // that is the mirror image of the bug this module exists to prevent.
    mocks.sendEmail.mockResolvedValue({ ok: true, id: "re_1" });
    mocks.recordEmailAttempt.mockResolvedValue(null);
    const res = await sendDocumentEmail(INPUT);
    expect(res.ok).toBe(true);
    expect(res.ok && res.logId).toBeNull();
  });
});

describe("success is never claimed without confirmation", () => {
  it("refuses to call an id-less acceptance a send", async () => {
    // Resend returning no id means we cannot prove anything. The old code's
    // instinct here was to show a tick anyway.
    //
    // That judgement now lives in the transport, which collapses an id-less
    // acceptance into `ok: false` with code `unconfirmed` — so BOTH callers get
    // it, not just this one. What is tested here is that this module still
    // reports it as unconfirmed rather than burying it in `provider_error`.
    mocks.sendEmail.mockResolvedValue({
      ok: false,
      error: "The provider accepted the request but returned no message id, so the send is unconfirmed.",
      code: "unconfirmed",
    });
    const res = await sendDocumentEmail(INPUT);
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.reason).toBe("unconfirmed");
    expect(loggedAttempt()).toMatchObject({ status: "FAILED", providerMessageId: null });
  });

  it("logs FAILED, never SENT, for every unsuccessful provider outcome", async () => {
    for (const providerError of [
      "Email is not configured (RESEND_API_KEY missing).",
      "The aec-flow.com domain is not verified.",
      "Invalid `to` field.",
      "Something nobody has seen before",
    ]) {
      vi.clearAllMocks();
      mocks.requireActor.mockResolvedValue(ACTOR);
      mocks.getFirmIdentity.mockResolvedValue({ name: "ZenArch", location: "", logo: null });
      mocks.recordEmailAttempt.mockResolvedValue("log_x");
      mocks.sendEmail.mockResolvedValue({ ok: false, error: providerError });

      const res = await sendDocumentEmail(INPUT);
      expect(res.ok, providerError).toBe(false);
      expect(loggedAttempt().status, providerError).toBe("FAILED");
      expect(loggedAttempt().providerMessageId, providerError).toBeNull();
      // The provider's own words are kept in the record even when the user is
      // shown a friendlier sentence.
      expect(loggedAttempt().error, providerError).toBe(providerError);
    }
  });
});

describe("failure messages a human can act on", () => {
  it("says email is not configured, and what to set", async () => {
    mocks.sendEmail.mockResolvedValue({ ok: false, error: "Email is not configured (RESEND_API_KEY missing)." });
    const res = await sendDocumentEmail(INPUT);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_configured");
    expect(res.error).toContain("RESEND_API_KEY");
  });

  it("says the domain is not verified", async () => {
    mocks.sendEmail.mockResolvedValue({ ok: false, error: "The aec-flow.com domain is not verified." });
    const res = await sendDocumentEmail(INPUT);
    expect(res.ok === false && res.reason).toBe("domain_not_verified");
    expect(res.ok === false && res.error).toContain("not verified");
  });

  it("passes an unrecognised provider error through in the provider's own words", async () => {
    mocks.sendEmail.mockResolvedValue({ ok: false, error: "Rate limit exceeded." });
    const res = await sendDocumentEmail(INPUT);
    expect(res.ok === false && res.reason).toBe("provider_error");
    expect(res.ok === false && res.error).toBe("Rate limit exceeded.");
  });
});

describe("validation happens before the provider is contacted", () => {
  it("rejects an invalid recipient, sends nothing, and STILL records the attempt", async () => {
    const res = await sendDocumentEmail({ ...INPUT, to: "not-an-address" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(res.ok === false && res.reason).toBe("invalid_recipient");
    expect(loggedAttempt()).toMatchObject({ status: "FAILED", to: "not-an-address", providerMessageId: null });
    expect(loggedAttempt().error).toContain("not-an-address");
  });

  it("rejects a bad cc rather than dropping it, and sends to nobody", async () => {
    const res = await sendDocumentEmail({ ...INPUT, cc: "good@example.com, rubbish" });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(res.ok === false && res.reason).toBe("invalid_recipient");
    expect(loggedAttempt().status).toBe("FAILED");
  });

  it("refuses an empty subject and an empty body, recording each", async () => {
    const noSubject = await sendDocumentEmail({ ...INPUT, subject: "   " });
    expect(noSubject.ok).toBe(false);
    expect(loggedAttempt().status).toBe("FAILED");
    expect(mocks.sendEmail).not.toHaveBeenCalled();

    vi.clearAllMocks();
    mocks.requireActor.mockResolvedValue(ACTOR);
    mocks.recordEmailAttempt.mockResolvedValue("log_1");
    const noBody = await sendDocumentEmail({ ...INPUT, body: "" });
    expect(noBody.ok).toBe(false);
    expect(loggedAttempt().status).toBe("FAILED");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});

describe("identity is resolved server-side, never taken from the caller", () => {
  it("stamps the record with the actor's own id, name and email", async () => {
    mocks.sendEmail.mockResolvedValue({ ok: true, id: "re_1" });
    // Anything extra on the input must be ignored. TypeScript already rejects
    // these fields; this guards the runtime shape a hand-crafted POST could send.
    await sendDocumentEmail({
      ...INPUT,
      ...({ companyId: "cmp_someone_else", senderName: "The Owner", from: "boss@rival.com" } as object),
    });
    expect(loggedAttempt()).toMatchObject({
      senderId: "usr_1",
      senderName: "Greg Laclé",
      senderEmail: "greg@aec-flow.com",
    });
    expect(loggedAttempt()).not.toHaveProperty("companyId");
    // Nor is a `from` ever handed to the provider — sendEmail reads EMAIL_FROM.
    expect(mocks.sendEmail.mock.calls[0][0]).not.toHaveProperty("from");
  });

  it("puts the practice's own name in the signature", async () => {
    mocks.sendEmail.mockResolvedValue({ ok: true, id: "re_1" });
    await sendDocumentEmail(INPUT);
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain("Greg Laclé · ZenArch Consultants");
  });

  it("refuses, sends nothing and logs nothing when there is no usable session", async () => {
    // No actor means no company to file a record under; inventing one would be
    // the cross-tenant write this whole design is built to avoid.
    mocks.requireActor.mockRejectedValue(new Error("Your account is not active."));
    const res = await sendDocumentEmail(INPUT);
    expect(res).toEqual({
      ok: false,
      reason: "not_signed_in",
      error: "Your account is not active.",
      logId: null,
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.recordEmailAttempt).not.toHaveBeenCalled();
  });

  it("sends anyway if the practice profile cannot be read — that is cosmetic", async () => {
    mocks.getFirmIdentity.mockRejectedValue(new Error("db down"));
    mocks.sendEmail.mockResolvedValue({ ok: true, id: "re_1" });
    const res = await sendDocumentEmail(INPUT);
    expect(res.ok).toBe(true);
  });
});

describe("the in-app link", () => {
  it("is dropped unless it is a plain same-origin path", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://aec-flow.com";
    mocks.sendEmail.mockResolvedValue({ ok: true, id: "re_1" });
    for (const bad of ["https://evil.example.com/x", "//evil.example.com/x", "javascript:alert(1)", "print/x"]) {
      vi.clearAllMocks();
      mocks.requireActor.mockResolvedValue(ACTOR);
      mocks.getFirmIdentity.mockResolvedValue({ name: "ZenArch", location: "", logo: null });
      mocks.recordEmailAttempt.mockResolvedValue("log_1");
      mocks.sendEmail.mockResolvedValue({ ok: true, id: "re_1" });
      await sendDocumentEmail({ ...INPUT, linkPath: bad });
      expect(mocks.sendEmail.mock.calls[0][0].text, bad).not.toContain("evil.example.com");
      expect(mocks.sendEmail.mock.calls[0][0].text, bad).not.toContain("javascript:");
    }
  });

  it("is built from the app's own origin, not from anything the caller sent", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://aec-flow.com/";
    mocks.sendEmail.mockResolvedValue({ ok: true, id: "re_1" });
    await sendDocumentEmail({ ...INPUT, linkPath: "/print/schedule/abc" });
    expect(mocks.sendEmail.mock.calls[0][0].text).toContain("https://aec-flow.com/print/schedule/abc");
  });
});

describe("classify", () => {
  it("maps the three real configuration states to distinct reasons", () => {
    expect(classify("Email is not configured (RESEND_API_KEY missing).")).toBe("not_configured");
    expect(classify("API key is invalid")).toBe("not_configured");
    expect(classify("The aec-flow.com domain is not verified.")).toBe("domain_not_verified");
    expect(classify("You must verify a domain before sending.")).toBe("domain_not_verified");
    expect(classify("Invalid `to` field.")).toBe("invalid_recipient");
    // The prose match must not claim a sentence merely CONTAINING "to".
    expect(classify("Invalid custom storage option.")).toBe("provider_error");
    expect(classify("teapot")).toBe("provider_error");
    expect(classify("")).toBe("provider_error");
  });

  it("prefers the provider's code over its prose", () => {
    // `invalid_from_address` reads as an invalid EMAIL address and used to be
    // classified as a bad RECIPIENT — pointing the user at the person they were
    // writing to, when the fault was the server's own sender.
    expect(classify("Invalid `from` field.", "invalid_from_address")).toBe("sender_not_configured");
    expect(classify("nothing recognisable", "missing_from_address")).toBe("sender_not_configured");
    expect(classify("nothing recognisable", "invalid_api_key")).toBe("not_configured");
    expect(classify("nothing recognisable", "restricted_api_key")).toBe("not_configured");
    expect(classify("nothing recognisable", "daily_quota_exceeded")).toBe("quota_exceeded");
    expect(classify("nothing recognisable", "monthly_quota_exceeded")).toBe("quota_exceeded");
    expect(classify("nothing recognisable", "rate_limit_exceeded")).toBe("quota_exceeded");
    expect(classify("nothing recognisable", "unconfirmed")).toBe("unconfirmed");
    // Codes too broad to trust fall back to the prose.
    expect(classify("The domain is not verified.", "validation_error")).toBe("domain_not_verified");
    expect(classify("teapot", null)).toBe("provider_error");
  });
});
