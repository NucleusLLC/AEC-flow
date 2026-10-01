# Server-action and API permission audit — 1 Oct 2026

Every `"use server"` file (39) and every non-auth `route.ts` (37) was read for one question: does
the check match what the call can do?

Two things already keep practices apart everywhere:

- the Prisma tenant extension in `lib/db.ts` scopes every tenant model to the caller's company;
- `proxy.ts` refuses every app path without a session while `AUTH_ENFORCE=true` (it is on in
  production).

What follows is what those two do not cover.

## Fixed

| Where | What was wrong | Fixed in |
|---|---|---|
| `app/(app)/settings/actions.ts` | Any member could replace or remove the firm's AI key, run billed test calls, and change the letterhead, logo, currency and font | #141 |
| `/beta-reports`, `setBetaReportStatus`, `loadBetaReportScreenshot` | Beta reports are not company-scoped: every member of every practice could list them all, with reporter emails, change their status and open their screenshots | this PR (founder only) |
| `submitBetaReport` | Took the reporter's id, name and email from the browser | this PR (from the session) |
| `getCurrentUserId` (`lib/data/notifications.ts`) | With no session it returned the oldest DIRECTOR of any company, so an anonymous call acted as them (notifications, beta reports, activity log) | this PR (null) |
| `aiFetchWikiArticle`, `permitSynopsisAction` | Billed AI calls with no check of who was asking | this PR (`requireActor`) |
| `/api/export/[entity]` | No check of its own; with `AUTH_ENFORCE` off, the team CSV came from the founder company | this PR (`requireActor`) |

## Decisions for the owner — not changed

All of these happen inside one practice. The tenant extension stops them from reaching another
practice. Whether a member *should* be able to do them is a product decision:

| Who can, today | Where |
|---|---|
| Any member, VIEWER included, can create, issue and void invoices, and record or delete payments | `app/(app)/finance/invoices/actions.ts` |
| Any member can create a leave request for anyone with status APPROVED, or approve their own | `app/(app)/leave/actions.ts`, `lib/data/leave.ts` |
| Any member can lock or unlock an estimate, and replace the whole price book, norm set, general conditions, templates and wiki (each save is delete-all then recreate) | `app/(app)/estimates/actions.ts` |
| Any member can issue, void and delete construction contracts and archive the contract templates | `app/(app)/documents/contracts/actions.ts` |
| Any member can issue, void, supersede and delete General Documents | `app/(app)/documents/general/actions.ts` |
| Any member can email any address through the platform sender, with no rate limit | `app/(app)/email/actions.ts` |
| Any member can change or delete proposal templates and the default | `app/(app)/settings/actions.ts` (templates) |
| Any member can delete purchase orders and record receipts | `app/(app)/procurement/actions.ts` |
| Any member can approve change orders and certifications, and delete change orders | `app/api/construction-admin/**` |
| Any member can overwrite a development project's payments, invoices, contracts and reservations | `app/api/development/[id]/**` |
| A STAFF member can edit a teammate's name, phone, leave balance and capacity, and add STAFF / MANAGER / VIEWER members (using seats) | `app/(app)/team/actions.ts` (`checkMemberWrite` guards only role, status and email) |
| Any member can run the AI features as often as they like (no per-user limit) | Write with AI, contract generator, drawing intake |

A VIEWER role exists but nothing reads it outside Service Proposals, so today a VIEWER can do
everything a STAFF member can.

## Worth a look — suspected, not proven

- `saveProposal` and several other saves write a `clientId` / `projectId` from the browser
  without checking it belongs to the caller's company. Someone who knew another practice's client
  id (a cuid, not guessable) could link it and read that client through the proposal.
- Service-proposal permissions read the role from the session token, which is not refreshed, so a
  demoted user keeps the old role until they next sign in.
- Most actions rely on `proxy.ts` alone for "signed in". The dev manifest registers an action only
  for the pages that import it, so the public pages do not appear to expose them. Adding
  `requireActor()` inside each action would remove the dependency anyway.
