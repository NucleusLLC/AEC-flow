# Firm Identity on Documents

> **Status:** Active. Describes how AEC-Flow decides *whose name* appears on a
> printed or previewed document. Companion to [`CURRENCY.md`](./CURRENCY.md),
> which covers the same question for the monetary unit.

Every document a company produces — fee proposal, order confirmation, cost
estimate, meeting minutes, Gantt sheet, fact sheet, directory — must carry **that
company's** name, logo and location. Nothing may hardcode a firm.

---

## 1. The bug this replaced

Printed documents carried the founder company's identity in their letterheads,
bodies, signature blocks and footers:

```
ZenArch Consultants · Dubai, United Arab Emirates · PRP-004
```

Both halves were wrong for everyone else, and the address was wrong for the
founder too (the practice is in Oranjestad, Aruba). At the time of the fix
**10 of 11 companies had never opened Settings → Practice**, so every one of them
sent client-facing documents out under another firm's name.

---

## 2. How the name resolves

Server-side, one resolver: **`getFirmIdentity()` — `lib/server/firm.ts`**

```
Settings → Practice profile name   →   the Company record's name   →   "AEC-flow"
    (what the company configured)        (always exists, from signup)    (neutral)
```

Step 2 is what makes the fix land for companies that never filled in the profile:
their signup company name ("Uzca Architects", "C+CC Engineers") is already known.
The last resort is the neutral **product** wordmark — never another firm's name.

The location line comes from the same profile, via `practiceLocationLine()`
(`lib/firm-identity.ts`): city, region and country joined, de-duplicated, with
`n/a`-style placeholders dropped. **It returns `""` when unconfigured, and callers
must then omit the segment entirely** — a document must never print a placeholder
address. `documentFooterLine()` does that joining for you.

---

## 3. The client/server split

`lib/firm-identity.ts` is client-safe and holds a module global, seeded in the
browser by `<FirmIdentityInit>` (app layout), exactly as `lib/format.ts` does for
the System Currency.

| Surface | How it gets the identity |
|---|---|
| `app/print/**` routes | `await getFirmIdentity()` → passed as `companyName` / `companyLocation` / `logo` props |
| In-app preview modals | the seeded global, via `firmName()` / `firmLocation()` / `firmLogo()` with no argument |

Preview modals (`ProposalPreviewModal`, `DocumentPreview`, the estimate print
overlay) are client components nested several levels inside client-only views;
threading a prop from a server parent would mean touching every intermediate
view. The global keeps preview and print showing the same thing.

### The logo travels the same way as the name

The seed carries the uploaded logo (data URL, position, size) as well, because
`ProposalPreviewModal` renders `<ProposalDocument>` with no logo prop — the
preview claimed to show "exactly what the client receives" while actually
showing a text wordmark where the print route showed the logo.

`DocumentLetterhead` resolves through `firmLogo(logo)`, which falls back **field
by field**: pass only a data URL and you still inherit the configured position
and size. So a new document surface gets the right logo by doing nothing.

### ⚠ Why the global is seeded ONLY in the browser

A server-side module global is **per-process and shared across concurrent
requests**, so seeding it on the server could bleed one tenant's firm name into
another tenant's document. `<FirmIdentityInit>` is `"use client"`, so on the
server the global stays empty and the explicit props apply. **Do not add a
server-side `setFirmIdentity()` call.** (This is a real difference from the
currency module, which does seed on the server — see `CURRENCY.md` §2.)

New print routes must therefore resolve the identity themselves; copy the pattern
in `app/print/proposals/[id]/page.tsx`.

---

## 4. Protected systems

Estimates and Schedule are protected (`protected-systems.md`). The identity fix
touched three files inside their inventories:

| File | Change |
|---|---|
| `components/estimates/estimate-document.tsx` | "Prepared by" line + footer use the resolved name |
| `components/estimates/estimate-view.tsx` | Email-PDF sign-off uses the resolved name |
| `components/schedule/schedule-print.tsx` | Title-block wordmark + initial use the resolved name |

These are **presentational identity strings only** — no calculation, version,
workflow, layout or responsive change. The policy permits connecting protected
systems to *shared document services*, which is what the letterhead is.
`npm run golden` passes unchanged. Per §"Change-control procedure" these were
flagged for explicit approval rather than made silently.

---

## 5. Rules when adding a document

1. Never write a firm name, address or wordmark as a literal.
2. Server route: `const firm = await getFirmIdentity()`; pass both values down.
3. Component: resolve with `firmName(prop)` / `firmLocation(prop)` so the preview
   path works too.
4. Build footers with `documentFooterLine(...)` so unset segments disappear
   instead of leaving `· ·`.
5. Sample and seed data may legitimately contain "ZenArch Consultants" as a
   *vendor* — that is demo content, not branding. Leave it.

Covered by `lib/firm-identity.test.ts` (17 tests).

---

## 6. How this was verified

Unit tests cover the resolvers, but the thing that actually matters — *does the
uploaded logo appear on the page* — was checked by rendering every document
against the live database with a headless browser, probing each page for an
`<img src="data:image…">` in the letterhead:

| Surface | Result |
|---|---|
| 19 print routes (service proposal, RFI, change order, certification, CA report, punch list, minutes, order, fee proposal, estimate, PO, materials schedule, design transmittal, development feasibility/investor, client & project fact sheets, team, practice overview, directory) | logo rendered, 56 px |
| In-app fee-proposal preview modal | logo rendered |
| Gantt / timeframe sheet | wired identically (`logo.dataUrl` → `<img>`); not rendered because the founder company has no schedule record |

Re-run it by pointing a headless browser at `/print/**` with a session cookie and
asserting on that `<img>`. Note the tenant scope returns **empty without a
session**, so unauthenticated print routes 404 by design — that is not a bug.
