/**
 * Which sidebar item is the current page.
 *
 * An item matches its own route and everything under it, so "Invoices" stays lit
 * on an invoice's detail page. That rule alone lights TWO items once a section
 * has an overview at a parent route: "Finance overview" (/finance) also matches
 * /finance/invoices/123. The most specific match wins — the longest href that
 * matches — so the overview is lit on /finance only and the register on its own
 * pages. Pure; the sidebar and the mobile menu both call it.
 */
export function isNavItemActive(
  pathname: string,
  href: string,
  siblings: readonly string[],
): boolean {
  const matches = (h: string) => pathname === h || pathname.startsWith(h + "/");
  if (!matches(href)) return false;
  return !siblings.some((h) => h !== href && h.length > href.length && matches(h));
}
