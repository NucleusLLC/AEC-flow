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

export function appVersionLabel(): string {
  const build = (process.env.APP_BUILD || "").trim();
  return build ? `v${APP_VERSION} · ${build}` : `v${APP_VERSION} · dev`;
}
