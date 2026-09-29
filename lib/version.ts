/**
 * App version + build identifier, shown in the sidebar to every user so it's
 * obvious which build is deployed (no more "did it ship?" guessing).
 *
 * APP_VERSION is the human version (bump on releases). The build id is the
 * short git commit SHA of the deploy: APP_BUILD when a manual `vercel deploy
 * -e APP_BUILD=…` sets it, otherwise VERCEL_GIT_COMMIT_SHA, which Vercel sets on
 * every Git-integrated deploy (a merge to main). It changes on every deploy, so
 * a changed build id = a new version shipped. "dev" when running locally.
 *
 * 0.2.0 (28 SEP 2026): the whole app in Spanish and Dutch; the menu in German,
 * Chinese, Japanese and Portuguese; Write with AI; invoicing from approved time
 * and expenses; add a client or project from a document; documents on A4.
 * 0.3.0 (28 SEP 2026): dates and "3 days ago" in the viewer's language.
 * 0.4.0 (28 SEP 2026): the whole app in German, Chinese, Japanese and Portuguese.
 * 0.5.0 (28 SEP 2026): attachments on building-permit letters.
 * 0.6.0 (29 SEP 2026): permit Process Summary (SITREP) with an AI synopsis, on A4.
 */
export const APP_VERSION = "0.6.0";

/**
 * Bright Turquoise — the colour a version is shown in, everywhere it appears.
 *
 * Defined here, in the app-version module, because this is the version a reader
 * looks for first: the build running in front of them. The Service Proposal's own
 * version tag imports the same constant, so the two can never disagree.
 */
export const VERSION_COLOR = "#08E8DE";

export function appVersionLabel(): string {
  const build = (process.env.APP_BUILD || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "").trim();
  return build ? `v${APP_VERSION} · ${build}` : `v${APP_VERSION} · dev`;
}
