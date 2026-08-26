# Turning on server-side email

*Written 2026-08-26, after "still can't email an estimate from AEC-flow".*

---

## 1. Why the Send button fails

Nothing is broken. `lib/server/email.ts` has sent mail through Resend since the
feature landed. What is missing is a **sending identity**, and it is missing at
the DNS level:

```
$ nslookup -type=MX  aec-flow.com    → no MX record
$ nslookup -type=TXT aec-flow.com    → no SPF record
```

No mailbox exists at `aec-flow.com` and nothing on the internet is authorised to
send as it. On top of that, production holds `RESEND_API_KEY` **present but
empty**, and the repo's `.env` ships the literal string `placeholder`.

So the app refuses, records the refusal in the email log, and says so. That is
the designed behaviour — see the "one rule" comment at the top of
`lib/server/document-email.ts`: `ok: true` is returned only when a message id
comes back.

## 2. The two things a human has to do

Everything else is automated by `scripts/email-setup.mjs`. These two are not,
because they need an account nobody else can open:

1. **Create a Resend account** at resend.com and generate an API key.
2. **Paste that key** into `.env` locally and into Vercel production.

## 3. The rest, in order

```bash
npm run mail:status                  # what is configured, what is not
npm run mail:add                     # registers aec-flow.com, prints its DNS records
npm run mail:dns                     # writes those records into Cloudflare
npm run mail:verify                  # asks Resend to re-check them
npm run mail:test -- you@example.com # sends one real email, prints the message id
```

`mail:dns` needs `CLOUDFLARE_API_TOKEN` with **Zone:DNS:Edit** on the
`aec-flow.com` zone. Without it, `mail:add` still prints the records and they can
be typed in by hand — the script exists to stop them being *re*typed from
memory, which is how a DNS record ends up silently doing nothing.

It **updates** a matching record rather than adding a second one. Two TXT records
at the same name is not an error to Cloudflare and is an unverifiable domain to
Resend.

Then in Vercel production:

```
RESEND_API_KEY = <the key>
EMAIL_FROM     = AEC-Flow <noreply@aec-flow.com>
```

and redeploy. `EMAIL_FROM` is read at module scope, so it needs the deploy.

## 4. The key is never printed

Not truncated, not in an error path, not in `status` — which reports only
`missing` / `placeholder` / `present`. This script is meant to be run while
someone is watching the screen, and a secret that reaches a terminal reaches
that terminal's scrollback.

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
