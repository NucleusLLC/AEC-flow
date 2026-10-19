import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getToken } from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  vi.resetModules();
});

describe("primary host root routing", () => {
  it.each([
    ["true", null, "/beta-portal"],
    ["true", { id: "user-1" }, "/dashboard"],
    ["true", {}, "/beta-portal"],
    ["false", null, "/beta-portal"],
    ["false", { id: "user-1" }, "/dashboard"],
    [undefined, null, "/beta-portal"],
    [undefined, { id: "user-1" }, "/dashboard"],
  ])("AUTH_ENFORCE=%s, token=%j redirects to %s", async (enforce, token, path) => {
    vi.stubEnv("AUTH_ENFORCE", enforce);
    vi.resetModules();
    // Partial tokens deliberately cover revoked sessions with no id.
    vi.mocked(getToken).mockResolvedValue(token as JWT | null);
    const { proxy } = await import("./proxy");
    const req = new NextRequest("https://aec-flow.com/", { headers: { host: "aec-flow.com" } });
    const response = await proxy(req);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(`https://aec-flow.com${path}`);
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it("keeps the enforced clients login redirect and callback URL", async () => {
    vi.stubEnv("AUTH_ENFORCE", "true");
    vi.resetModules();
    vi.mocked(getToken).mockResolvedValue(null);
    const { proxy } = await import("./proxy");
    const req = new NextRequest("https://aec-flow.com/clients", { headers: { host: "aec-flow.com" } });
    const response = await proxy(req);
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://aec-flow.com/login?callbackUrl=%2Fclients");
    expect(getToken).toHaveBeenCalledTimes(1);
  });
});
