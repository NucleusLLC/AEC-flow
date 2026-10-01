import { describe, expect, it } from "vitest";
import {
  ERROR_LOG_TAG,
  MAX_MESSAGE_CHARS,
  MAX_STACK_LINES,
  bugReportPrefill,
  clientErrorRecord,
  formatLogLine,
  redactPath,
  redactText,
  serverErrorRecord,
} from "./error-record";

const BUILD = { version: "0.9.0", build: "abc1234" };
const NOW = new Date("2026-10-02T03:00:00Z");

describe("redactText", () => {
  it("masks emails, keys, JWTs, bearer tokens, connection strings and long tokens", () => {
    const s = redactText(
      [
        "user greg@zenarch.net failed",
        "key sk-ant-api03-abcdefghijklmnop",
        "resend re_AbCdEfGh12345678",
        "pat sbp_0123456789abcdef",
        "jwt eyJhbGciOiJIUzI1.eyJzdWIiOiIxMjM0.SflKxwRJSMeKKF2QT4",
        "Authorization: Bearer abcdefghijklmnop",
        "postgresql://postgres:hunter2@db.example.com:5432/postgres",
        "token 3f2a9c1e5b7d4f60a8c2e1b3d5f7a9c1e3b5d7f9",
      ].join(" | "),
    );
    for (const leaked of [
      "greg@zenarch.net",
      "sk-ant",
      "re_AbCd",
      "sbp_0123",
      "eyJhbGci",
      "abcdefghijklmnop",
      "hunter2",
      "3f2a9c1e5b7d",
    ]) {
      expect(s).not.toContain(leaked);
    }
    expect(s).toContain("[email]");
    expect(s).toContain("Bearer [secret]");
    expect(s).toContain("postgresql://[secret]");
  });

  it("leaves ordinary text and short ids alone", () => {
    expect(redactText("Cannot read properties of undefined (reading 'total')")).toBe(
      "Cannot read properties of undefined (reading 'total')",
    );
    expect(redactText("/projects/clx9a8b7c6d5e4f3g2h1")).toBe("/projects/clx9a8b7c6d5e4f3g2h1");
  });
});

describe("redactPath", () => {
  it("drops the query string and hash", () => {
    expect(redactPath("/finance/invoices?status=open&q=greg#top")).toBe("/finance/invoices");
  });

  it("hides the credential in reset, invite and verify links", () => {
    expect(redactPath("/reset-password/abc")).toBe("/reset-password/[token]");
    expect(redactPath("/invite/xyz123")).toBe("/invite/[token]");
    expect(redactPath("/verify-email/t0k3n")).toBe("/verify-email/[token]");
  });

  it("keeps a route pattern as it is", () => {
    expect(redactPath("/reset-password/[token]")).toBe("/reset-password/[token]");
    expect(redactPath("/projects/[id]")).toBe("/projects/[id]");
  });
});

describe("serverErrorRecord", () => {
  it("keeps the digest, the route pattern and a short stack", () => {
    const err = Object.assign(new Error("boom for greg@zenarch.net"), { digest: "2856743012" });
    err.stack = ["Error: boom", ...Array.from({ length: 20 }, (_, i) => `    at f${i} (file.js:${i}:1)`)].join("\n");
    const r = serverErrorRecord(
      err,
      { path: "/reset-password/secret-token?x=1", method: "GET" },
      { routePath: "/reset-password/[token]", routeType: "render", renderSource: "server-rendering" },
      BUILD,
      NOW,
    );
    expect(r).toMatchObject({
      kind: "server",
      at: "2026-10-02T03:00:00.000Z",
      digest: "2856743012",
      name: "Error",
      message: "boom for [email]",
      method: "GET",
      path: "/reset-password/[token]",
      route: "/reset-password/[token]",
      routeType: "render",
      version: "0.9.0",
      build: "abc1234",
    });
    expect(r.stack).toHaveLength(MAX_STACK_LINES);
    expect(r.stack?.[0]).toBe("at f0 (file.js:0:1)");
  });

  it("copes with a thrown string or nothing at all", () => {
    const ctx = { routePath: "/x", routeType: "action" };
    expect(serverErrorRecord("plain", { path: "/x", method: "POST" }, ctx, BUILD, NOW).message).toBe("plain");
    expect(serverErrorRecord(undefined, { path: "/x", method: "POST" }, ctx, BUILD, NOW).message).toBe("");
  });

  it("clamps a huge message", () => {
    const r = serverErrorRecord(new Error("x ".repeat(2000)), { path: "/", method: "GET" }, { routePath: "/", routeType: "render" }, BUILD, NOW);
    expect(r.message.length).toBeLessThanOrEqual(MAX_MESSAGE_CHARS + 1);
  });
});

describe("clientErrorRecord", () => {
  it("accepts a browser report and stamps who and which build", () => {
    const r = clientErrorRecord(
      { source: "boundary", message: "t is not a function", name: "TypeError", digest: "123", path: "/invite/abc?x=1", userAgent: "UA" },
      { userId: "u1", companyId: "c1" },
      BUILD,
      NOW,
    );
    expect(r).toMatchObject({
      kind: "client",
      source: "boundary",
      digest: "123",
      name: "TypeError",
      message: "t is not a function",
      path: "/invite/[token]",
      userId: "u1",
      companyId: "c1",
      build: "abc1234",
    });
  });

  it("refuses an empty or malformed report, and drops a bad digest or source", () => {
    expect(clientErrorRecord({}, {}, BUILD, NOW)).toBeNull();
    expect(clientErrorRecord(null as never, {}, BUILD, NOW)).toBeNull();
    const r = clientErrorRecord({ message: "x", source: "evil", digest: "<script>" }, {}, BUILD, NOW);
    expect(r?.source).toBe("window");
    expect(r?.digest).toBeUndefined();
  });
});

describe("formatLogLine", () => {
  it("is one tagged line of JSON", () => {
    const r = clientErrorRecord({ message: "a\nb" }, {}, BUILD, NOW)!;
    const line = formatLogLine(r);
    expect(line.startsWith(`${ERROR_LOG_TAG} {`)).toBe(true);
    expect(line).not.toContain("\n");
    expect(JSON.parse(line.slice(ERROR_LOG_TAG.length + 1)).message).toBe("a\nb");
  });
});

describe("bugReportPrefill", () => {
  it("names the error and carries the ref, page and version", () => {
    const p = bugReportPrefill({ message: "Failed to fetch", digest: "99", path: "/projects/abc?tab=1", version: "0.9.0" });
    expect(p.title).toBe("Error: Failed to fetch");
    expect(p.description).toContain("Page: /projects/abc");
    expect(p.description).toContain("Ref: 99");
    expect(p.description).toContain("Version: 0.9.0");
    expect(p.description).not.toContain("tab=1");
  });

  it("works without a digest or message", () => {
    const p = bugReportPrefill({ message: "", path: "/", version: "0.9.0" });
    expect(p.title).toBe("Error: something went wrong");
    expect(p.description).not.toContain("Ref:");
  });
});
