/**
 * Opens the beta Bug/Wish widget from anywhere in the tree.
 *
 * The widget is mounted once in the (app) layout, while its launchers live in the
 * sidebar and the mobile drawer — different subtrees with no common provider. A
 * window event is the cheapest bridge: no context, no store, no prop drilling
 * through the shell.
 */
export const BETA_REPORT_OPEN_EVENT = "beta-report:open";

/** Optional text to start the report with — an error page fills in what it knows. */
export type BetaReportPrefill = { title: string; description: string };

export function openBetaReport(prefill?: BetaReportPrefill) {
  window.dispatchEvent(new CustomEvent<BetaReportPrefill | undefined>(BETA_REPORT_OPEN_EVENT, { detail: prefill }));
}
