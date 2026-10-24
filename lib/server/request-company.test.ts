/**
 * runAsCompany — how a route handler with no session (the Stripe webhook, the
 * public /pay checkout) scopes its queries to one practice. React `cache` does
 * not memoise outside a render, so `companyOverride()` cannot carry the company
 * there; AsyncLocalStorage follows the awaited call instead.
 */
import { describe, expect, it } from "vitest";
import { currentCompanyId, runAsCompany } from "./request-company";

describe("runAsCompany", () => {
  it("scopes every query in the call, across awaits, to the named company", async () => {
    const seen = await runAsCompany("co_A", async () => {
      const first = await currentCompanyId();
      await new Promise((r) => setTimeout(r, 5));
      const second = await currentCompanyId();
      return [first, second];
    });
    expect(seen).toEqual(["co_A", "co_A"]);
  });

  it("keeps two concurrent calls apart", async () => {
    const [a, b] = await Promise.all([
      runAsCompany("co_A", async () => {
        await new Promise((r) => setTimeout(r, 10));
        return currentCompanyId();
      }),
      runAsCompany("co_B", async () => currentCompanyId()),
    ]);
    expect([a, b]).toEqual(["co_A", "co_B"]);
  });

  it("refuses an empty company", () => {
    expect(() => runAsCompany("", async () => 1)).toThrow();
  });
});
