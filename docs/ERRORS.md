# Finding errors

AEC-flow records every error in one place: the Vercel function logs, as single lines tagged
`[aecflow-error]`. No outside service, no database table.

## Where they come from

| `kind` | `source` | Written by | When |
|---|---|---|---|
| `server` | — | `instrumentation.ts` (`onRequestError`) | A page render, server action, route handler or the proxy throws |
| `client` | `boundary` | `app/(app)/error.tsx` | An app page shows "Something went wrong" |
| `client` | `window` | `components/observability/client-error-listener.tsx` | An uncaught exception in the browser |
| `client` | `promise` | same | An unhandled promise rejection in the browser |

Client reports go to `POST /api/client-error` (signed-in only, 16 KB cap, 60 per minute per
server instance, 5 per page load) and carry the user and company ids.

## Finding one

- **All errors:** Vercel → project `aec-flow` → Logs → search `[aecflow-error]`.
- **The one a user saw:** the error page shows `ref: 806680849`. That is the digest; search for it.
  The server line and the browser line share it.
- **From a bug report:** "Report this problem" on the error page opens Bug/Wish with the page, the
  ref and the version filled in, so a report in `/beta-reports` leads to the log line.

## What a line never contains

`lib/observability/error-record.ts` strips query strings, the token in reset / invite / verify
links, email addresses, API keys (`sk-…`, `re_…`, `sbp_…`), JWTs, bearer tokens, connection
strings and long hex or base64 runs. Messages are capped at 500 characters and stacks at 8 lines.
Its tests (`error-record.test.ts`) pin each of these.

## Later

Vercel's log retention is short on the current plan. If errors need keeping, alerting or
grouping, the next step is a vendor such as Sentry, which `instrumentation.ts` and
`reportClientError` can forward to without touching the call sites.
