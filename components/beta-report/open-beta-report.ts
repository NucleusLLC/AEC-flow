/**
 * Opens the beta Bug/Wish widget from anywhere in the tree.
 *
 * The widget is mounted once in the (app) layout, while its launchers live in the
 * sidebar and the mobile drawer — different subtrees with no common provider. A
 * window event is the cheapest bridge: no context, no store, no prop drilling
 * through the shell.
 */
export const BETA_REPORT_OPEN_EVENT = "beta-report:open";

export function openBetaReport() {
  window.dispatchEvent(new CustomEvent(BETA_REPORT_OPEN_EVENT));
}
