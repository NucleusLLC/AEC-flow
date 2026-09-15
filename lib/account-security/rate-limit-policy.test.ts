import { describe, it, expect } from "vitest";
import {
  RATE_LIMITS,
  clientIpFrom,
  decide,
  rateLimitKey,
  tooManyAttemptsMessage,
} from "./rate-limit-policy";

const rule = { prefix: "test", limit: 3, windowSeconds: 60 };

describe("rateLimitKey", () => {
  it("normalises case and whitespace so an address cannot dodge its counter", () => {
    expect(rateLimitKey(rule, "  Greg@Example.COM ")).toBe("test:greg@example.com");
    expect(rateLimitKey(rule, "greg@example.com")).toBe("test:greg@example.com");
  });

  it("buckets an empty subject as unknown rather than a shared empty key", () => {
    expect(rateLimitKey(rule, "")).toBe("test:unknown");
    expect(rateLimitKey(rule, "   ")).toBe("test:unknown");
  });

  it("clamps a hostile subject length", () => {
    expect(rateLimitKey(rule, "a".repeat(10_000)).length).toBe("test:".length + 320);
  });

  it("gives every rule its own namespace", () => {
    const prefixes = Object.values(RATE_LIMITS).map((r) => r.prefix);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });
});

describe("decide", () => {
  it("allows up to and including the limit", () => {
    expect(decide(rule, 1, 50)).toEqual({ allowed: true });
    expect(decide(rule, 3, 50)).toEqual({ allowed: true });
  });

  it("refuses the attempt after the limit, with the time left in the window", () => {
    expect(decide(rule, 4, 42.2)).toEqual({ allowed: false, retryAfterSeconds: 43 });
  });

  it("never reports a zero or negative wait", () => {
    expect(decide(rule, 9, 0)).toEqual({ allowed: false, retryAfterSeconds: 1 });
    expect(decide(rule, 9, -5)).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });
});

describe("tooManyAttemptsMessage", () => {
  it("rounds up to whole minutes and pluralises", () => {
    expect(tooManyAttemptsMessage("sign-in attempts", 30)).toBe("Too many sign-in attempts. Try again in 1 minute.");
    expect(tooManyAttemptsMessage("sign-in attempts", 61)).toBe("Too many sign-in attempts. Try again in 2 minutes.");
  });
});

describe("clientIpFrom", () => {
  const headers = (h: Record<string, string>) => (name: string) => h[name];

  it("prefers the platform header", () => {
    expect(clientIpFrom(headers({ "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
  });

  it("takes only the first x-forwarded-for entry", () => {
    expect(clientIpFrom(headers({ "x-forwarded-for": " 3.3.3.3 , 10.0.0.1" }))).toBe("3.3.3.3");
  });

  it("falls back to unknown", () => {
    expect(clientIpFrom(headers({}))).toBe("unknown");
  });
});
