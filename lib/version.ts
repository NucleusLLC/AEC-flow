/**
 * App version + build identifier, shown in the sidebar to every user so it's
 * obvious which build is deployed (no more "did it ship?" guessing).
 *
 * APP_VERSION is the human version (bump on releases). The build id is injected
 * at deploy time as the short git commit SHA via `vercel deploy -e APP_BUILD=…`
 * — it changes on every deploy, so a changed build id = a new version shipped.
 * Falls back to "dev" when running locally.
 */
export const APP_VERSION = "0.1.0";

/**
 * Bright Turquoise — the colour a version is shown in, everywhere it appears.
 *
 * Defined here, in the app-version module, because this is the version a reader
 * looks for first: the build running in front of them. The Service Proposal's own
 * version tag imports the same constant, so the two can never disagree.
 */
export const VERSION_COLOR = "#08E8DE";

export function appVersionLabel(): string {
  const build = (process.env.APP_BUILD || "").trim();
  return build ? `v${APP_VERSION} · ${build}` : `v${APP_VERSION} · dev`;
}
