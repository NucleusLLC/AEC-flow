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
 * 0.12.4 (1 OCT 2026): feat — Take-Off "ADD NEW": an item missing from the Norm Set
 *   dropdown is typed in, saved to the firm's Norm Set and linked to the row.
 * 0.12.1 (1 OCT 2026): feat — every New Client (the client page and each inline
 *   "add a client" in other sections) asks for CLIENT NAME, EMAIL and CELL NUMBER.
 * 0.12.5 (6 OCT 2026): Design "Architecture" removed from the sidebar; drawings live
 *   under Drawings, deliverables under Design Register.
 * 0.12.6 (6 OCT 2026): Design "Engineering" and "Interior Design" removed from the
 *   sidebar, as Architecture was in 0.12.5.
 * 0.13.1 (6 OCT 2026): feat — Projects ARCHIVE / RESTORE and DELETE. Archived projects leave
 *   the list and the tiles; DELETE only on an archived project nothing else points at,
 *   confirmed by typing the project number. Needs prisma/sql/0026_project_archive.sql.
 * 0.14.0 (7 OCT 2026): feat — /officedash, the office TV board (SITREP, dark blue): engaged
 *   projects, unsigned proposals to chase, open building permits with days in and the
 *   next deadline, and the day's orders. Refreshes itself; sign in once on the TV.
 * 0.14.1 (7 OCT 2026): /officedash runs like the Sigma board: projects 20 s (larger names), a
 *   full Building Permits sheet 10 s, then sigma-cms.com/officedash. Sigma's stats + news
 *   bar along the bottom.
 * 0.15.0 (7 OCT 2026): feat — Building Permit DEADLINE: set a deadline on a permit (submit review,
 *   reply / respond, or OTHER typed in) with its date. Yellow on the Dashboard and the Office Dash,
 *   red inside 14 days, blinking red inside 3 and when overdue; MET takes it off.
 *   Needs prisma/sql/0027_permit_deadlines.sql.
 * 0.15.1 (7 OCT 2026): /officedash hands over to the Nucleus development board
 *   (nucleus-apps.vercel.app/officedash) instead of Sigma; the loop is now
 *   AEC-flow -> Nucleus -> Sigma -> AEC-flow.
 * 0.16.0 (7 OCT 2026): feat — Projects DEVELOPMENT: a tick box beside the disciplines; ticked, it
 *   asks the DEVELOPMENT TYPE (Housing, Condo / Apartment, Town Homes, Resort, Parceling, or
 *   OTHER typed in) and shows "Development · …" on the Projects list, the overview and the
 *   printed sheet. Needs prisma/sql/0028_project_development.sql.
 * 0.16.1 (8 OCT 2026): Office Dash projects sheet 30 s; every font on the board 15% larger.
 * 0.18.0 (8 OCT 2026): feat — project PHASES on the Timeframe & Phases tab: EDIT PHASES / + ADD PHASE
 *   (rename, reorder, remove, dates, status, % complete, discipline), quick-add presets and LOAD
 *   STANDARD PHASES; project progress = equal-weighted average of the phases. The timesheet asks
 *   for the PHASE once a project is chosen, and the phase screen shows hours by phase and person.
 *   No SQL.
 * 0.18.1 (8 OCT 2026): feat — ARCHITECTURE TYPE on a project (Single Family Home, Mansion,
 *   Commercial, Retail, Apartment/Condo Building, Apartment, School, Resort, Other + typed);
 *   needs prisma/sql/0029_project_architecture_type.sql (applied 8 OCT).
 * 0.21.0 (8 OCT 2026): feat — /progressdash, the AEC-FLOW · BUILD TIMELINE office-TV board
 *   (public, like /officedash): build phases with a Gantt of the days worked since 14 SEP, the
 *   releases, WORKING ON NOW and MISSING, the stats strip and news. The TV run now goes
 *   /officedash -> /progressdash (30 s) -> Nucleus. Content is lib/progressdash/data.ts. No SQL.
 * 0.22.0 (8 OCT 2026): feat — Finance TAX REPORT (/finance/tax, Admin / Director only): BBO, BAVP and
 *   any other tax the invoices carry, per currency, for a month or a quarter (default the last full
 *   month), on two bases — INVOICED (by issue date; drafts and voids left out) and RECEIVED (payments
 *   in the period, tax pro rata). Invoices without tax are listed under NOTES, never imputed at 7%.
 *   Printable on A4 (/print/finance/tax) and a "Tax report" CSV in the accounting export. No SQL.
 * 0.23.0 (9 OCT 2026): feat — a FINANCE tab on every project (/projects/[id]/finance): contract value
 *   against invoiced (issued, not void), received, outstanding and overdue, with % of contract billed,
 *   per currency; approved work not yet billed, with RAISE AN INVOICE; the job's margin (Admin /
 *   Director only); hours by phase and by person; the project's invoices and expenses. Read-only,
 *   no SQL.
 * 0.24.0 (9 OCT 2026): feat — Finance RECEIPTS and OVERDUE CHASE. A photo or PDF receipt on an
 *   expense (JPEG/PNG/WebP/HEIC/PDF, 10 MB), in the private bucket under receipts/, opened through a
 *   five-minute signed URL for the person who recorded it or an administrator; frozen once invoiced;
 *   a paperclip in the expense register. /finance/invoices/overdue lists invoices with money
 *   outstanding past due, by client and currency, with a "Copy reminder" to paste into an email or
 *   WhatsApp (nothing is sent). Needs prisma/sql/0031_expense_receipts.sql applied FIRST.
 */
export const APP_VERSION = "0.24.0";

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
