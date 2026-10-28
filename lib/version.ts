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
 * 0.25.0 (9 OCT 2026): feat — Finance RECEIVABLES and CREDIT NOTES: who owes what by client, aged
 *   Current / 1–30 / 31–60 / 61–90 / 90+ per currency; each client's Statement of Account (running
 *   balance for a period) on screen and printed on A4. CREDIT NOTES (CN-YYYY-NNN) against an issued
 *   invoice — whole or chosen lines, never more than it still owes; issuing or voiding one is for
 *   Admin / Director only. Issued credits reduce the balance, receivables and the statement.
 *   Needs prisma/sql/0030_credit_notes.sql (applied 9 OCT).
 * 0.25.3 (10 OCT 2026): feat — INTERACTIVE-GUIDE on the Estimates editor, Spanish only for now: the
 *   button turns magenta and a callout card flies from one part of the screen to the next, lighting
 *   each up for 5 seconds with what it is for (29 steps; Back / Pause / Next, Esc stops). Parts that
 *   are not on screen are skipped. It only reads the page: nothing is saved or changed. No SQL.
 * 0.25.4 (10 OCT 2026): fix — sending a Bug/Wish report no longer takes the app down when the
 *   browser is translating the page (Edge / Chrome Translate). The translator replaces text with
 *   its own elements; pressing Send then made React insert the spinner before a label that was no
 *   longer on the page ("Failed to execute 'insertBefore' on 'Node'") and, the panel being part of
 *   the app layout, everything became "Something went wrong" although the report was saved. The
 *   label now sits in its own element; a failure inside the panel stays inside the panel; a submit
 *   that fails says so in a plain sentence (never the database's own words) and keeps what was
 *   typed; and the outer error page now logs what it catches. No SQL.
 * 0.25.5 (10 OCT 2026): feat — ESTIMATES in the Architecture & Engineering Design module: the
 *   Module 1 sidebar gets an Estimating section opening the same /estimates as Module 3 and
 *   Complete AEC, so architecture and interior projects are priced without switching module.
 *   Navigation only; no SQL.
 * 0.25.7 (10 OCT 2026): feat — the INTERACTIVE-GUIDE is read aloud in Spanish by a Fish Audio
 *   voice: each card's text is spoken while it is lit (symbols and abbreviations read as words),
 *   the card holds for max(5 s, clip + 0.6 s), Pause / Next / Back / stop silence it, and a
 *   speaker button mutes it per browser. Clips are made once and kept in the private bucket.
 *   Founder only: Settings > Integrations > Guide narration (key, voice, model, on/off, test,
 *   clear cache). Silent exactly as before until a key is saved there. No SQL.
 * 0.25.8 (11 OCT 2026): feat — the INTERACTIVE-GUIDE in English as well as Spanish: the button and
 *   the full 29-step tour appear when the interface is in English, with cards written for the
 *   English screen (every control named as that screen names it) and read aloud by an English
 *   voice ("square metres", "version one point zero", "per cent"). Voices are per language in
 *   Settings > Integrations > Guide narration, each with its own shortlist and Test voice;
 *   Generate all clips makes both languages and Clear cached audio clears both. The Spanish
 *   texts, voice and cached clips are untouched (their cache keys are pinned by a test). Also:
 *   the button now shows on the Estimates landing screen too, where it opens one card saying to
 *   open a project, or create one with New estimate, to start the tour; a new user could not
 *   find the guide before an estimate was open. Every other language still has no button. No SQL.
 * 0.25.9 (11 OCT 2026): fix — a new beta signup got three sample clients and four tasks and
 *   nothing else: no sample project, schedule, estimate or proposal, and no error anywhere.
 *   The seed re-read the clients it had just created, and at signup (a request with no session
 *   yet) the tenant scope answers every read with nothing, so there was no client to file a
 *   project under. It now keeps the rows it creates, each entity is seeded on its own so one
 *   failure cannot drop the rest, and any failure is one [aecflow-error] line naming the step.
 *   The seeded estimate is keyed by its project, so it opens from the project too. New signups
 *   only; companies already created are not touched. No SQL.
 * 0.25.10 (11 OCT 2026): feat — ZEBRA shading on every list: one stripe, defined once (tokens and
 *   the zebra-row / zebra-list classes in globals.css), on every register and row list, the
 *   Estimates project list included. Hover and selected rows are tinted so they never read as a
 *   stripe; grouped, filtered and expanded tables stay in step. The Estimate editor, the Gantt,
 *   the Take-Off and everything printed are unchanged. Presentation only. No SQL.
 * 0.25.11 (11 OCT 2026): feat — sample files. One complete sample project that runs through
 *   every live module (client, project, service proposal, estimate, schedule, tasks, minutes,
 *   building permit, construction records, purchase order, materials, deliverables, a letter,
 *   a contract, a paid invoice with its time and expense), in English or Spanish, every record
 *   marked SAMPLE / EJEMPLO and numbered on its own SMP- series so no real number is used up.
 *   A new signup gets it in the language it signed up in. Settings > Practice > Sample files:
 *   each practice installs or removes its own. /admin > Sample files (founder): dry run, then
 *   push to one company or to every beta company without one. While installed, the sample
 *   invoice, payment, time and expense count in that practice's finance figures. No SQL.
 * 0.25.12 (11 OCT 2026): feat — an INTERACTIVE-GUIDE for Service Proposals, in Spanish and English.
 *   The proposal form (new and edit) gets the same button and a 22-step narrated tour, top to
 *   bottom: template, title, number, client, project, contact, currency, cost basis, fees, phases,
 *   payment schedule, reimbursables, tax and discount, scope, terms, validity, saving and the
 *   live summary. A step whose section is not on the form (no template on an existing proposal,
 *   no cost basis without a percentage fee) is skipped. The Service Proposals list shows the
 *   button with one card saying how to start. The guide is now an engine that runs a definition
 *   per screen: Estimates and Service Proposals share the overlay, button, player, narration
 *   route and cache, and clip ids are namespaced per guide. The Estimates tour, its texts and
 *   every cached Estimates clip in both languages are unchanged (pinned by tests). Generate all
 *   clips now covers every guide and shows progress per guide. No SQL.
 * 0.25.13 (12 OCT 2026): fix — four open items. (1) FINANCE: an invoice raised from a proposal's
 *   payment milestone billed the tax twice when the proposal's tax is added on top. The milestone
 *   is a share of the grand total, tax included, and the invoice then added the tax again (a
 *   535.00 milestone was invoiced as 572.45). The line now carries the milestone before tax and
 *   the invoice adds it once (lib/finance/proposal-billing.ts); included taxes are unchanged; a
 *   partly taxed proposal gives a taxed and an untaxed line. Invoices already raised are NOT
 *   changed. The sample invoice had the same fault and is corrected for new installs. (2) GUIDE:
 *   Spanish Estimates step 20 no longer promises a duplicate icon the screen does not have.
 *   (3) GUIDE: Spanish cards use "usted", like the rest of the Spanish app; the changed cards are
 *   narrated again on first listen. (4) The floating INTERACTIVE-GUIDE button steps aside while
 *   the Bug / Wish panel is open, so it no longer covers Send on narrower screens. No SQL.
 * 0.25.14 (12 OCT 2026): feat — the updater. A tab left open kept running the release it started
 *   with and nothing said so. Every signed-in screen now asks /api/version what is deployed (one
 *   minute after opening, every five minutes, and on coming back to the tab) and, when that is a
 *   different release, shows "A new version of AEC-flow is available" with Reload now and Later.
 *   It never reloads by itself: there may be unsaved work in the tab. Six languages. No SQL.
 * 0.26.0 (15 OCT 2026): feat — request a beta code from the portal; /signup?code= prefill;
 *   issued codes redeem at signup.
 * 0.27.0 (15 OCT 2026): feat — Vercel Web Analytics with portal CTA, signup and first-print events.
 * 0.27.1 (15 OCT 2026): fix — the 0.26.0 and 0.27.0 merges left two APP_VERSION constants and two
 *   "version" keys in package.json and package-lock.json, and a SignupForm test that no longer
 *   type-checked against the new initialCode prop. The build failed; this is the repair.
 * 0.27.2 (15 OCT 2026): fix — a signed-out visitor to / lands on the beta portal, not the login form.
 * 0.27.3 (15 OCT 2026): the shared BETA_SIGNUP_CODE is no longer accepted; every beta account now carries a pool code.
 * 0.27.4 (19 OCT 2026): fix — the 0.27.2 and 0.27.3 merges again left two APP_VERSION constants
 *   and two "version" keys; the build failed. One of each again. No other change.
 * 0.28.0 (16 OCT 2026): own take-off engine — area, length and count measured on drawings in
 *   PDF points, scale notes read (1:100, 1/4" = 1'-0"), totals per condition feeding the Quantity
 *   Take-Off sheet (engine only; the measuring screen follows).
 * 0.29.0 (16 OCT 2026): measure on drawings - conditions, calibrated areas,
 *   lengths, counts and cut-outs feed the existing Quantity Take-Off sheet.
 * 0.30.0 (19 OCT 2026): feat — INVOICE where the work is. /finance, the Finance overview: a big
 *   + INVOICE button, outstanding / overdue / received this month / drafts per currency, the latest
 *   invoices and every finance register; first item of the Finance section, which Modules 2 and 3
 *   now have too. An Invoice button on an accepted Service Proposal (straight to its milestones),
 *   on every project header (the new-invoice screen for that project) and on the Dashboard, and
 *   New invoice in the + New menu. Settings > Invoicing (Admin / Director): default payment terms,
 *   bank details and terms & conditions; the printed invoice carries the bank details under the
 *   totals and the T&C after the notes or on a second A4 sheet. Voiding an invoice, deleting a
 *   payment and deleting a draft are now Admin / Director only. No SQL.
 * 0.31.0 (19 OCT 2026): feat — a project's Documents tab lists only that project's paperwork: its General
 *   Documents (with New document pre-filed to the project and Link an existing document), its
 *   construction contracts and its building permit files. Any General Document, signed ones too,
 *   can be filed under a project from its own page; the wording is never altered. No SQL.
 * 0.32.0 (19 OCT 2026): feat — SCHEDULING: book meetings, inspections, measuring, supervision and site
 *   visits for a project or a potential project (a Service Proposal) at /scheduling; a project's new
 *   Scheduling tab shows its upcoming visits, its history and the hours of completed field work (visits
 *   booked on a proposal later converted to the project included); completing a visit records the actual
 *   hours and outcome and can put DRAFT entries on the attendees' timesheets, once. Six languages.
 *   Needs prisma/sql/0035_appointments.sql applied FIRST.
 * 0.33.0 (23 OCT 2026): release — the take-off engine (0.28.0), measuring on drawings (0.29.0) and the
 *   Finance overview with the INVOICE button (0.30.0) brought onto main after 0.31.0 and 0.32.0. The
 *   Finance overview is now also first in Module 1's Finance section. No SQL.
 * 0.34.0 (23 OCT 2026): feat — an invoice can carry TWO taxes (Aruba: BBO + BAVP). The second tax
 *   (name + percent, optional) is charged on the same amounts as the first, never on top of it, and
 *   rounded on its own; "already in the amounts" backs the combined rate out and splits it by rate.
 *   Snapshotted like the first; credit notes take back both in proportion; the tax report counts each
 *   under its own name; the accounting CSV gains Tax 2 columns; invoice and credit-note screens and
 *   prints show a second tax line. One-tax invoices are unchanged. Raising from a proposal with two
 *   taxes in one mode now carries them as two taxes instead of one combined line (three or more still
 *   combine, with a warning). Needs prisma/sql/0032_invoice_second_tax.sql applied FIRST.
 * 0.35.0 (23 OCT 2026): feat — SUBSCRIPTION BILLING for AEC-flow itself (decision D-5: Stripe Billing
 *   on the Nucleus LLC account). Settings › Billing (Admin / Director): plan, status, renewal date,
 *   seats; SUBSCRIBE (monthly / yearly) through Stripe Checkout and MANAGE BILLING through the
 *   Stripe Customer Portal. /api/billing/webhook (signed, idempotent) keeps the status current. A
 *   dismissable banner for past-due / canceled; NOTHING is locked (BILLING_ENFORCED = false); the
 *   founder practice never pays. Hidden until the Stripe env vars are set.
 *   Needs prisma/sql/0033_billing_subscriptions.sql applied FIRST.
 * 0.36.0 (23 OCT 2026): feat — PAY ONLINE. A practice connects its own Stripe account (Settings →
 *   Integrations → Online payments, Stripe Connect, Admin / Director only); its issued invoices then
 *   carry a "Pay online" link (on screen and printed) to a public /pay page where the client pays
 *   the amount owed by card, straight into the practice's Stripe account (no platform fee). The
 *   signed Stripe webhook records the payment ("Card (Stripe)"), once. Off until STRIPE_SECRET_KEY
 *   and STRIPE_WEBHOOK_SECRET are set. Needs prisma/sql/0034_stripe_pay_now.sql applied FIRST.
 * 0.37.0 (27 OCT 2026): feat — CONNECTED APPS. A public API (/api/v1, docs/api/v1.md) for desktop
 *   add-ins, first M.E.P.flow: an Admin / Director creates an API token in Settings → Integrations →
 *   Connected apps (shown once, only its sha256 stored; list, last used, revoke). With
 *   `Authorization: Bearer aecf_…` an add-in reads GET /api/v1/me and GET /api/v1/projects and sends
 *   its material take-off to POST /api/v1/estimates/import, which creates a DRAFT cost estimate
 *   (quantities only, every unit cost 0) in the token's practice, optionally filed under a project.
 *   Expired licence → 403. Needs prisma/sql/0036_api_tokens.sql applied FIRST.
 * 0.38.0 (28 OCT 2026): feat — INVOICING PHASE B. "Email invoice" sends the invoice as a PDF built on
 *   the server (pdf-lib, no browser) through the one email path, and marks it SENT — a new status,
 *   open like Issued — only when the mail provider confirmed. A voided invoice can be RE-ISSUED as a
 *   new draft numbered <number>-2 (-3 …), linked both ways, re-claiming its proposal milestones only
 *   if nothing else bills them. Every payment gets a numbered receipt (RCT-YYYY-NNN) to print or
 *   email. A payment is REVERSED with a reason instead of deleted: it stays visible, struck through,
 *   and stops counting everywhere. An invoice may carry a DISCOUNT (percent or amount) taken off
 *   before tax. Admin / Director / founder for void, re-issue and reverse.
 *   Needs prisma/sql/0037_invoice_phase_b.sql applied FIRST.
 */
export const APP_VERSION = "0.38.0";

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
