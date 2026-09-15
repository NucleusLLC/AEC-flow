# Turning on server-side email

*Written 2026-08-26, after "still can't email an estimate from AEC-flow".*
*Revised 2026-08-27, after an end-to-end audit of the code path and the live
configuration. What changed is in §7.*

---

## 1. Why the Send button fails

Nothing is broken. `lib/server/email.ts` has been correct since the feature
landed. What is missing is a **sending identity**, and it is missing at the DNS
level:

```
$ nslookup -type=TXT resend._domainkey.aec-flow.com   → NXDOMAIN
$ nslookup -type=TXT send.aec-flow.com                → NXDOMAIN
$ nslookup -type=MX  send.aec-flow.com                → NXDOMAIN
```

Nothing on the internet is authorised to send as `aec-flow.com`. On top of that,
production holds `RESEND_API_KEY` **present but empty**, and holds no
`EMAIL_FROM` at all.

Note what is *not* wanted here: an SPF record at the apex. Resend's SPF lives on
the `send.` subdomain, which is the envelope domain. Adding an apex SPF is a
common reflex and does nothing for this.

So the app refuses, records the refusal in the email log, and says so. That is
the designed behaviour — see the "one rule" comment at the top of
`lib/server/document-email.ts`: `ok: true` is returned only when a message id
comes back.

## 2. The three things a human has to do

Everything else is automated by `scripts/email-setup.mjs`. These three are not,
because each needs a browser session nobody else can open:

1. **Create the Resend API key** at resend.com → API Keys. It is shown once.
   Keys minted through the Resend MCP integration have not produced a working
   token — if `mail:status` says *"present but the provider rejects it"*, this is
   why, and the dashboard is the way round it.
2. **Create the Cloudflare API token** with **Zone:DNS:Edit** on the
   `aec-flow.com` zone (Cloudflare → My Profile → API Tokens). Only needed for
   `mail:dns`; without it the records can be pasted by hand.
3. **Paste both into `.env`**, and set `RESEND_API_KEY` + `EMAIL_FROM` in Vercel
   production.

## 3. The rest, in order

```bash
npm run mail:status                  # what is configured, what is not
npm run mail:add                     # registers aec-flow.com, prints its DNS records
npm run mail:dns                     # writes those records into Cloudflare
npm run mail:verify                  # asks Resend to re-check them (polls; verification is async)
npm run mail:test -- you@example.com # sends one real email, prints the message id
```

`EMAIL_FROM` must be set **locally as well**, before `mail:test`. Without it the
transport refuses outright — see §7 for why that is better than the alternative.

`mail:dns` needs `CLOUDFLARE_API_TOKEN`. It **updates** a matching record rather
than adding a second one (two TXT records at one name is not an error to
Cloudflare and is an unverifiable domain to Resend), skips records that are
already correct, and prints old → new before replacing anything.

A **Sending access** key can send but cannot read `/domains`. `mail:status`
reports that and carries on; `add` / `dns` / `verify` need a full-access key and
say so.

Then in Vercel production — `RESEND_API_KEY` exists and must be **edited**;
`EMAIL_FROM` does not exist yet and must be **added**:

```
RESEND_API_KEY = <the key>
EMAIL_FROM     = AEC-Flow <noreply@aec-flow.com>
```

and redeploy. Both are read at module scope, so an env change alone does
nothing. That redeploy must be of a commit where this branch is merged, or the
deployed code is not the code this document describes.

Prove it with `mail:test` **to an address that is not the Resend account
owner's**. A test to the account owner passes even on the sandbox sender and
proves nothing about `aec-flow.com`.

## 4. The key is never printed

Not truncated, not in an error path, not in `status` — which reports only
`missing` / `placeholder` / `present`. This script is meant to be run while
someone is watching the screen, and a secret that reaches a terminal reaches
that terminal's scrollback.

The `re_` prefix check is a **shape** check, not a validity check. A well-formed
key the provider rejects passes it, reaches Resend, and comes back as
`invalid_api_key` — which `mail:status` and the app both now name explicitly
rather than reporting as "email is not configured".

## 5. Why not SMTP through the existing A2 mailbox

It was considered and rejected. The A2 hosting is `taxatie-bureau.com`, so mail
would leave as `@taxatie-bureau.com` — the wrong identity in front of an
AEC-flow client. Forcing a `@aec-flow.com` From with no SPF record gets it
filed as spam. Same amount of work, worse outcome.

## 6. Still not solved: attachments

There is no server-side PDF generator, so no email from AEC-flow carries the
document. Every route — the Send button and the four mailbox buttons in the
compose dialog — names the document and expects the sender to attach it by hand
from its Print/Preview screen. The compose dialog says so on screen rather than
leaving it to be discovered.

The default message bodies no longer open with *"Please find attached…"*. They
said that while the compose dialog appended a line saying the document was **not**
attached; the recipient reads the sender's own sentence first.

## 7. What the audit changed

### The sandbox sender is no longer a fallback

`EMAIL_FROM` unset used to silently become `AEC-Flow <onboarding@resend.dev>`.
That address **delivers for real, with a real message id — but only to the Resend
account owner**. A test send to yourself came back green and proved nothing,
while every send to a client 403'd. Behaviour that changes by recipient is the
worst possible thing to debug, so an unset `EMAIL_FROM` is now a refusal.

Set `EMAIL_ALLOW_SANDBOX=1` to opt back in for local work.

### `ok: true` now carries a message id by construction

`SendResult` was `{ ok: true; id: string | null }`. The document path checked for
the null; the invitation path did not, and reported *"Invite emailed to …"* on an
acceptance that proved nothing — the same bug as the original green-tick
incident, in the file nobody re-read. The transport now collapses an id-less
acceptance into `{ ok: false, code: "unconfirmed" }`, so both callers get it.

### Failures are classified by the provider's code, not by its prose

Resend ships stable codes (`invalid_api_key`, `invalid_from_address`,
`daily_quota_exceeded`, …). `classify()` used to substring-match English, which
put `invalid_from_address` — a broken **sender** — into the "invalid recipient"
bucket and logged it against the person being written to. Two new reasons exist:
`sender_not_configured` and `quota_exceeded` (the free tier is 100/day, and that
is the most likely first real failure).

### Invitations are recorded

They previously wrote no `EmailLog` row at all, which made two statements false:
the module contract ("every attempt is recorded") and the Correspondence page's
own copy ("every message AEC-flow has attempted to send for this practice"). They
are now recorded like any other send — **without** the accept token or URL, which
is a live credential and a wider audience than the one addressee.

### Invite links survive an empty env var

`appBaseUrl()` used `??`, which only falls through on `undefined`. This
deployment already holds one variable present-but-empty; the same on
`NEXTAUTH_URL` would have produced a relative `/invite/<token>` — a dead link in
the recipient's mail client, invisible to the sender, whose own copy-link comes
from `window.location.origin`.

## 8. Known gaps, deliberately not closed here

- **No DMARC record.** `_dmarc.aec-flow.com` does not exist. Resend's SPF sits on
  `send.` while the From domain is the apex, so SPF will not align — DKIM carries
  alignment, and it aligns relaxed, so DMARC will pass once DKIM is live. Add
  `v=DMARC1; p=none; rua=mailto:…` **after** one real email is confirmed
  delivered, and leave it at `p=none` for a week of reports. Tightening early is
  how you black-hole your own client mail.
- **Replies go nowhere.** There is no MX at the apex and `Receiving` is disabled
  on the Resend domain. Bounces are handled by SES via the `send` MX and show up
  in the Resend dashboard; **replies are not handled at all**, and these emails
  invite one. `sendEmail` has no `replyTo` support yet.
- **No bounce or complaint webhooks**, so a hard bounce is invisible to the app.
  `EmailLog` records the send attempt and nothing after it.
- **The Resend account is shared with `blucapitalgroup.net`.** Free-tier limits,
  sender reputation and the suppression list are shared across both products, and
  rotating a key here can break BLU's mail.
- **No Preview or Development environment variables exist on the Vercel
  project** — all of them are Production-only, so "test it on a preview URL
  first" is not available for anything that needs the database or email.
