import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * THE TRANSPORT — the module that decides what counts as "sent".
 *
 * This is the one file the email work kept changing and never covered, and the
 * two bugs that reached production both lived in the gap: an acceptance without
 * a message id being reported as a send, and an unset EMAIL_FROM silently
 * borrowing Resend's sandbox sender (which delivers ONLY to the Resend account
 * owner — so it passes every test you run on yourself and fails for every
 * client).
 *
 * WHAT IS MOCKED:
 *   server-only — a Next.js-supplied module that does not resolve under Vitest.
 *   resend      — the SDK. Mocked at its constructor so each test decides what
 *                 the provider "answers" without a network call or a real key.
 *
 * Nothing else. The point of these tests is what THIS module does with the
 * provider's answer, and with the environment.
 */

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

const ENV = { ...process.env };

/** The module caches its Resend client, so each test needs a fresh copy. */
async function load() {
  vi.resetModules();
  return await import("@/lib/server/email");
}

const MESSAGE = {
  to: "client@example.com",
  subject: "Estimate",
  html: "<p>Estimate</p>",
};

beforeEach(() => {
  mocks.send.mockReset();
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "AEC-Flow <noreply@aec-flow.com>";
  delete process.env.EMAIL_ALLOW_SANDBOX;
});

afterEach(() => {
  process.env = { ...ENV };
});

describe("sendEmail — the API key", () => {
  it("refuses, without contacting anyone, when the key is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const { sendEmail } = await load();
    const res = await sendEmail(MESSAGE);
    expect(res).toEqual({
      ok: false,
      error: expect.stringContaining("not configured"),
      code: "missing_api_key",
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("treats a present-but-empty key as absent", async () => {
    // Production held RESEND_API_KEY as an empty string for weeks. `??` would
    // have accepted it and handed the provider an empty credential.
    process.env.RESEND_API_KEY = "   ";
    const { sendEmail } = await load();
    const res = await sendEmail(MESSAGE);
    expect(res.ok).toBe(false);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("refuses a key that is not shaped like a key", async () => {
    process.env.RESEND_API_KEY = "placeholder";
    const { sendEmail } = await load();
    const res = await sendEmail(MESSAGE);
    expect(res).toMatchObject({ ok: false, code: "missing_api_key" });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("lets a well-formed key through — the shape check is not a validity check", async () => {
    // A dead-but-well-formed key must reach the provider and come back with the
    // provider's own code, not be mistaken here for "email is not configured".
    mocks.send.mockResolvedValue({
      data: null,
      error: { name: "invalid_api_key", message: "API key is invalid" },
    });
    const { sendEmail } = await load();
    const res = await sendEmail(MESSAGE);
    expect(mocks.send).toHaveBeenCalledOnce();
    expect(res).toMatchObject({ ok: false, code: "invalid_api_key" });
  });
});

describe("sendEmail — the sender", () => {
  it("refuses when EMAIL_FROM is unset, rather than borrowing the sandbox sender", async () => {
    delete process.env.EMAIL_FROM;
    const { sendEmail } = await load();
    const res = await sendEmail(MESSAGE);
    expect(res).toEqual({
      ok: false,
      error: expect.stringContaining("EMAIL_FROM"),
      code: "missing_from_address",
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("treats a present-but-empty EMAIL_FROM as unset", async () => {
    process.env.EMAIL_FROM = "  ";
    const { sendEmail } = await load();
    expect(await sendEmail(MESSAGE)).toMatchObject({ code: "missing_from_address" });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("uses the sandbox sender only when it is explicitly opted into", async () => {
    delete process.env.EMAIL_FROM;
    process.env.EMAIL_ALLOW_SANDBOX = "1";
    mocks.send.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    const { sendEmail } = await load();
    const res = await sendEmail(MESSAGE);
    expect(res).toEqual({ ok: true, id: "msg_1" });
    expect(mocks.send.mock.calls[0][0].from).toBe("AEC-Flow <onboarding@resend.dev>");
  });

  it("sends from EMAIL_FROM, never from anything a caller supplied", async () => {
    mocks.send.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    const { sendEmail } = await load();
    // @ts-expect-error — `from` is deliberately not part of the input type.
    await sendEmail({ ...MESSAGE, from: "ceo@somewhere-else.com" });
    expect(mocks.send.mock.calls[0][0].from).toBe("AEC-Flow <noreply@aec-flow.com>");
  });
});

describe("sendEmail — what counts as sent", () => {
  it("is ok ONLY with a message id", async () => {
    mocks.send.mockResolvedValue({ data: { id: "msg_abc" }, error: null });
    const { sendEmail } = await load();
    expect(await sendEmail(MESSAGE)).toEqual({ ok: true, id: "msg_abc" });
  });

  it("refuses to call an acceptance without an id a send", async () => {
    // THE bug. The provider raises no error and returns no id; every previous
    // version of this shape let `ok: true` out of here with `id: null`, and one
    // of the two callers then reported it to a user as delivered.
    mocks.send.mockResolvedValue({ data: {}, error: null });
    const { sendEmail } = await load();
    const res = await sendEmail(MESSAGE);
    expect(res).toMatchObject({ ok: false, code: "unconfirmed" });
    expect(res.ok).toBe(false);
  });

  it("refuses a null payload with no error just the same", async () => {
    mocks.send.mockResolvedValue({ data: null, error: null });
    const { sendEmail } = await load();
    expect(await sendEmail(MESSAGE)).toMatchObject({ ok: false, code: "unconfirmed" });
  });

  it("carries the provider's machine-readable code, not just its prose", async () => {
    // `invalid_from_address` classified by prose became "invalid recipient" —
    // a broken sender reported to the user as a bad address for the person
    // being written to, and logged against them.
    mocks.send.mockResolvedValue({
      data: null,
      error: { name: "invalid_from_address", message: "Invalid `from` field." },
    });
    const { sendEmail } = await load();
    expect(await sendEmail(MESSAGE)).toEqual({
      ok: false,
      error: "Invalid `from` field.",
      code: "invalid_from_address",
    });
  });

  it("survives the SDK throwing, and says so without a code", async () => {
    mocks.send.mockRejectedValue(new Error("socket hang up"));
    const { sendEmail } = await load();
    expect(await sendEmail(MESSAGE)).toEqual({
      ok: false,
      error: "socket hang up",
      code: null,
    });
  });
});

describe("sendEmail — the payload", () => {
  beforeEach(() => {
    mocks.send.mockResolvedValue({ data: { id: "msg_1" }, error: null });
  });

  it("omits cc entirely when there is none", async () => {
    const { sendEmail } = await load();
    await sendEmail(MESSAGE);
    expect(mocks.send.mock.calls[0][0]).not.toHaveProperty("cc");
  });

  it("omits cc when every entry is blank", async () => {
    const { sendEmail } = await load();
    await sendEmail({ ...MESSAGE, cc: ["", "   "] });
    expect(mocks.send.mock.calls[0][0]).not.toHaveProperty("cc");
  });

  it("passes the copies through when there are real ones", async () => {
    const { sendEmail } = await load();
    await sendEmail({ ...MESSAGE, cc: ["a@example.com", " ", "b@example.com"] });
    expect(mocks.send.mock.calls[0][0].cc).toEqual(["a@example.com", "b@example.com"]);
  });

  it("derives a text part from the html when none is given", async () => {
    const { sendEmail } = await load();
    await sendEmail({ ...MESSAGE, html: "<p>Hello</p><p>World</p>" });
    const text = mocks.send.mock.calls[0][0].text as string;
    expect(text).not.toContain("<p>");
    expect(text).toContain("Hello");
  });

  it("keeps an explicit text part as given", async () => {
    const { sendEmail } = await load();
    await sendEmail({ ...MESSAGE, text: "plain words" });
    expect(mocks.send.mock.calls[0][0].text).toBe("plain words");
  });
});

describe("sendInviteEmail", () => {
  it("returns the same shape as any other send, so a caller cannot forget the id", async () => {
    mocks.send.mockResolvedValue({ data: {}, error: null });
    const { sendInviteEmail } = await load();
    const res = await sendInviteEmail({
      to: "new@example.com",
      companyName: "Laclé Architects",
      invitedByName: "Greg",
      role: "MEMBER",
      acceptUrl: "https://aec-flow.com/invite/tok",
      expiresAt: new Date("2026-09-10T00:00:00Z"),
    });
    expect(res.ok).toBe(false);
    expect(res).toMatchObject({ code: "unconfirmed" });
  });

  it("puts the accept link in the message", async () => {
    mocks.send.mockResolvedValue({ data: { id: "msg_1" }, error: null });
    const { sendInviteEmail } = await load();
    await sendInviteEmail({
      to: "new@example.com",
      companyName: "Laclé Architects",
      role: "MEMBER",
      acceptUrl: "https://aec-flow.com/invite/tok123",
      expiresAt: null,
    });
    expect(mocks.send.mock.calls[0][0].html).toContain("https://aec-flow.com/invite/tok123");
  });
});
