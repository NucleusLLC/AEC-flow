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
 * 0.6.1 (29 SEP 2026): fix — the contract generator ran into a 400 on Opus 5.
 * 0.7.0 (29 SEP 2026): permit revision deadline with a blinking dashboard reminder
 *   (needs prisma/sql/0024_permit_revision_reminder.sql applied first).
 * 0.7.1 (30 SEP 2026): fix — a client's Service Proposals now show on the client page;
 *   a client with no email says so, with a link to add one.
 * 0.8.0 (1 OCT 2026): Terms of Service and Privacy Policy; sign-up and invites ask
 *   for agreement and record which versions were accepted.
 * 0.9.0 (1 OCT 2026): error tracking — every server and browser error is one
 *   [aecflow-error] line in the Vercel logs; error pages report and offer Bug/Wish.
 * 0.10.0 (1 OCT 2026): existing accounts are asked to accept the Terms and Privacy
 *   Policy (a banner; it asks, never blocks), and again whenever a version changes.
 * 0.11.0 (1 OCT 2026): accounting export — invoices, invoice lines, payments, approved
 *   time and approved expenses as CSV for a period (Admin / Director only).
 * 0.11.1 (1 OCT 2026): fix — any member could change or remove the firm's AI key,
 *   letterhead, logo, currency and document font; now Admin / Director only.
 * 0.12.0 (1 OCT 2026): feat — Estimates "Copy Section over": pick another Job Order,
 *   tick sections (or single lines) of its cost estimate, and copy them into this one.
 * 0.11.2 (1 OCT 2026): fix — every practice could read every practice's beta reports;
 *   a request with no session borrowed a director's identity; two AI actions and the
 *   CSV export did not check who was asking.
 * 0.12.2 (1 OCT 2026): feat — Take-Off "ADD NEW": an item missing from the Norm Set
 *   dropdown is typed in, saved to the firm's Norm Set and linked to the row.
 * 0.12.1 (1 OCT 2026): feat — every New Client (the client page and each inline
 *   "add a client" in other sections) asks for CLIENT NAME, EMAIL and CELL NUMBER.
 */
export const APP_VERSION = "0.12.3";

/**
 * Bright Turquoise — the colour a version is shown in, everywhere it appears.
 *
 * Defined here, in the app-version module, because this is the version a reader
 * looks for first: the build running in front of them. The Service Proposal's own
 * version tag imports the same constant, so the two can never disagree.
 */
export const VERSION_COLOR = "#08E8DE";

/** The deploy's short commit, or "" when running locally. Server-side only. */
export function appBuildId(): string {
  return (process.env.APP_BUILD || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "").trim();
}

export function appVersionLabel(): string {
  const build = appBuildId();
  return build ? `v${APP_VERSION} · ${build}` : `v${APP_VERSION} · dev`;
}
