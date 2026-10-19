import { describe, expect, it } from "vitest";
import { isNavItemActive } from "./nav-active";

const FINANCE = ["/finance", "/finance/invoices", "/finance/credit-notes", "/projects"];

describe("isNavItemActive", () => {
  it("lights the overview on its own route only", () => {
    expect(isNavItemActive("/finance", "/finance", FINANCE)).toBe(true);
    expect(isNavItemActive("/finance/invoices", "/finance", FINANCE)).toBe(false);
    expect(isNavItemActive("/finance/invoices/abc", "/finance", FINANCE)).toBe(false);
  });

  it("lights an item on its route and below it", () => {
    expect(isNavItemActive("/finance/invoices", "/finance/invoices", FINANCE)).toBe(true);
    expect(isNavItemActive("/finance/invoices/abc/edit", "/finance/invoices", FINANCE)).toBe(true);
    expect(isNavItemActive("/projects/1/finance", "/projects", FINANCE)).toBe(true);
  });

  it("does not match a route that merely shares a prefix", () => {
    expect(isNavItemActive("/financeX", "/finance", FINANCE)).toBe(false);
  });

  it("still lights a parent route whose child page is not in the nav", () => {
    expect(isNavItemActive("/finance/tax", "/finance", FINANCE)).toBe(true);
  });
});
