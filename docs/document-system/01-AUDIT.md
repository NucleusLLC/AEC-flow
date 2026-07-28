# Document System — Phase 1 Forensic Audit

> **Status:** Phase 1 deliverable (§5 of the Document Generation Directive).
> **Date:** 2026-07-27. **Scope:** repository-wide.
> **Implementation has NOT begun.** §49 gates broad implementation on this audit
> plus the decisions listed in §6 below.

---

## 1. Headline findings

Five findings determine everything that follows.

### F1 — There is no PDF renderer, no DOCX renderer, and no document font system

`package.json` has **32 dependencies and not one** PDF, DOCX, HTML-to-PDF,
font-embedding or image-processing library. Verified by pattern search across
`dependencies` + `devDependencies`.

Every "export" in this application is **the browser's own Save-as-PDF dialog**,
triggered by `window.print()` against an HTML page carrying `@page` CSS.

Consequences for the directive, stated plainly:

| Directive requirement | Status today |
|---|---|
| §25.2 PDF: embedded fonts, bookmarks, metadata, no rasterization | **Not achievable** — the browser controls all of this, not the app |
| §25.3 DOCX with real named styles | **Does not exist** — no DOCX writer at all |
| §25.4 Email renderer | **Does not exist** — `EmailButton` logs to console (see F5) |
| §11 font embedding + per-renderer compatibility | **No mechanism** — fonts are whatever the print browser resolves |
| §40 visual regression on exported files | **No headless renderer** in the repo to produce them |

This is not a styling problem. Roughly half the directive's acceptance criteria
require build-out of rendering infrastructure that does not exist, and that means
new dependencies. **That is a decision for the owner, not for me** (§6.D1).

### F2 — Page geometry is duplicated inline across ~15 files, with divergent values

94 print-CSS occurrences. `@page` is declared inline per route, not centrally:

| Declared rule | Files |
|---|---|
| `size: A4 portrait; margin: 14mm` | 5 |
| `size: A4; margin: 14mm` | 5 |
| `size: A4 landscape; margin: 12mm` | 1 |
| `size: ${paper} ${orient}; margin: 7mm 7mm 11mm 7mm` | 1 |
| `size: ${pw}mm ${ph}mm; margin: 8mm` / `6mm` | 2 |
| `size: ${paper} ${orient}; margin: 0` | 1 |

So margins range from **0mm to 14mm** with no shared token, and A4 is hardcoded
almost everywhere — Letter and Legal (§15) are unsupported except inside the
Estimates and Schedule engines.

### F3 — Two real layout engines already exist, and both are inside PROTECTED systems

- `lib/estimates/pagination-engine.ts` — **863 lines**. A genuine measured
  pagination engine (keep-together, page fitting, grand-total rows).
- `components/estimates/estimate-print-doc.tsx` — **1,426 lines**. Paper/orientation
  selection, running headers, cover page, footer font control, page counters.
- `components/schedule/schedule-print.tsx` — paper A4/A3/A2/A1 × orientation.

**These are the only components in the codebase that satisfy any of §15, §21 or
§24.** They are also declared protected by `docs/protected-systems.md`, which
forbids internal change without written approval.

The directive's §12 ("no active template may independently introduce arbitrary
font sizes, row padding, margins") and §24 (shared pagination engine) **cannot
both be satisfied and leave Estimates untouched**. This is a direct policy
conflict requiring an owner decision (§6.D2).

### F4 — ~20 of the ~40 required document types do not exist

Existing print surfaces (24 routes) cover: proposals, service proposals,
estimates, change orders, certifications, RFIs, CA reports, punch lists,
meeting minutes, transmittals, purchase orders, materials schedules,
development feasibility/investor/lots/closeout, client/project/team fact
sheets, directory, practice overview, schedule.

**Absent entirely** — no template, no route, no data model in several cases:

letters · memos · field reports · site-inspection reports · progress reports ·
RFI responses · submittal documents (form exists, no document) · notices ·
work authorizations · scope-of-work documents · quotations · invoices ·
statements · payment applications · deficiency reports · non-conformance
reports · checklists · drawing registers · document registers · handover
documents · general custom documents

These are **new feature development**, not migration of existing templates. §26–§32
specify letters, memos, field reports and punch lists in detail; three of those four
do not exist today.

### F5 — Document font configuration is currently an unvalidated free-text field

`lib/server/practice-config.ts:37-42` + `components/settings/practice-form.tsx:340`
expose `footer.fontFamily` as a **raw text input**, stored with
`.slice(0, 120)` and no validation, applied via inline
`style={{ fontFamily }}`. It affects the footer only.

This is precisely what §48 prohibits ("allow untested arbitrary fonts"). The app
font is **Geist** (`app/layout.tsx`, `next/font/google`) — not Inter, and not
document-scoped. There is no font catalog, no fallback chain, no per-renderer
capability matrix, no font persistence on issued documents.

Also: `components/email/email-button.tsx` is a **placeholder that logs to the
console** — documented as such in `docs/protected-schedule-files.md:36`. Any claim
of an email renderer today would be false.

---

## 2. Audit matrix

| Area | Current implementation | Files | Problems | Reusable | Required action |
|---|---|---|---|---|---|
| PDF export | Browser `window.print()` + `@page` CSS | ~15 print routes | No embedding, bookmarks, metadata; output depends on user's browser/OS | Partially | Decide: keep browser-print, or add a real PDF pipeline (D1) |
| DOCX export | **None** | — | Requirement unmet | No | New dependency + writer, or descope |
| Email render | Console-logging stub | `components/email/email-button.tsx` | Non-functional; a live "Email PDF" button | No | Build or disclose as non-functional |
| Page geometry | Inline `@page` per route | ~15 files | 0–14mm margin drift; A4 hardcoded | No | Central page tokens (§15) |
| Pagination | Real engine, Estimates only | `lib/estimates/pagination-engine.ts` (863 ln) | Protected; not shared | **Yes — high value** | Extract or wrap (D2) |
| Letterhead | `DocumentLetterhead` → `BrandMark` | 12 consumers | Sound; already logo-aware | **Yes** | Keep as the §16 header base |
| Doc shells | `CaPrintShell` (8), `DevPrintShell` (4) | 2 files | Two divergent shells | **Yes** | Converge behind shared header/footer |
| Second letterhead | Schedule title block | `components/schedule/schedule-print.tsx:270` | Divergent impl (badge+initial, no tagline) | Partially | Converge (protected — D2) |
| Hardcoded brand | `EstimateLogo` inline SVG `ZENARCH` | `components/estimates/estimate-print-doc.tsx:104-146` | **Multi-tenant leak** | No | Replace with logo/`firmName()` (protected — D2) |
| Hardcoded brand | `Calculation by ZENARCH` | `components/estimates/rebar-calculator-view.tsx:365` | Multi-tenant leak | No | Replace (protected — D2) |
| Typography | Tailwind utilities inline per template | all templates | No tokens; `text-[11px]`, `text-[9px]` etc. scattered | No | Token system (§12/§13) |
| Density | **None** | — | §14 unmet | No | New |
| Font system | Free-text footer font only | `practice-config.ts`, `practice-form.tsx` | Unvalidated; footer-scoped | No | Font catalog (§11) |
| Doc settings | Settings → Practice (logo, footer, currency) | `lib/server/practice-config.ts` | No Document Control area | Partially | Extend to §10 |
| Doc model | `GeneratedDocument` = **audit record only** | `prisma/schema.prisma:1770` | Records `renderUrl`; not a content model | No | Normalized model (§9) |
| Branding | `getFirmIdentity()` / `firmLogo()` | `lib/server/firm.ts`, `lib/firm-identity.ts` | Sound; shipped today | **Yes** | Basis for §3 preservation |
| Formatters | Centralized | `lib/format.ts` | Sound | **Yes** | Keep |
| Versioning | Estimates only (`V1.0`); Schedule none | — | §35 largely unmet | Partially | New |
| Validation | **None** for documents | — | §37 unmet | No | New |
| Diagnostics | **None** | — | §38 unmet | No | New |
| Visual tests | **None** | — | §40 unmet | No | New (needs headless renderer) |

## 3. Document inventory (active surfaces)

| Document type | Template | Renderer | Export formats | Active | Quality |
|---|---|---|---|---|---|
| Service proposal | `app/print/service-proposals/[id]` | CaPrintShell | Browser PDF | Yes | Fair |
| Fee proposal | `components/proposals/proposal-document.tsx` | DocumentLetterhead | Browser PDF | Yes | Fair |
| Cost estimate | `estimate-print-doc.tsx` | **own engine** | Browser PDF | Yes | Good (best in repo) |
| Schedule / Gantt | `schedule-print.tsx` | **own** | Browser PDF | Yes | Good |
| Change order, Certification, RFI, CA report | `app/print/construction-admin/*` | CaPrintShell | Browser PDF | Yes | Fair |
| Punch list | `app/print/construction-admin/punch-list/[project]` | DocumentLetterhead | Browser PDF | Yes | Fair |
| Meeting minutes | `components/meetings/meeting-document.tsx` | DocumentLetterhead | Browser PDF | Yes | Fair |
| Order confirmation | `components/orders/order-document.tsx` | DocumentLetterhead | Browser PDF | Yes | Fair |
| Purchase order, Materials, Transmittal | `app/print/{procurement,materials,design}` | CaPrintShell | Browser PDF | Yes | Fair |
| Development (4) | `app/print/development/[id]/*` | DevPrintShell | Browser PDF | Yes | Fair |
| Fact sheets, directory, overview, team | `app/print/*` | DocumentLetterhead | Browser PDF | Yes | Fair |
| **Letter, Memo, Field report, Invoice, Statement, Payment application, Submittal doc, Notice, NCR, Deficiency, Checklist, Registers, Handover, Custom** | **—** | **—** | **—** | **No** | **Does not exist** |

## 4. Branding & typography inventory

| Element | Current source | Behavior | Risk | Migration action |
|---|---|---|---|---|
| System Logo placeholder | `components/print/brand-mark.tsx` + `document-letterhead.tsx` | `<img>` when data URL present, else name wordmark | **Low — already protected & shipped** | Formalize as §3 `systemLogoPlaceholder`; keep field name |
| Logo storage | `AppConfig.logoDataUrl` (Postgres JSON, data URL) | Per-company | Data-URL bloat; no aspect-ratio guard beyond `object-contain` | Add max W/H tokens, validation, alignment (§3.1) |
| Logo upload | Settings → Practice (`saveLogo`, 1.5 MB cap) | Works | Low | Move under Document Control, keep field |
| Logo fallback | `firmLogo()` field-by-field, browser-seeded | Works | Print routes are outside `(app)`, so seed is always empty there — one omitted prop from silent regression | Add runtime diagnostic (§38) |
| Primary font | Geist via `next/font/google` (app-wide) | Not document-scoped | Not on the approved §11 list | Introduce document font catalog |
| Font fallbacks | **None declared** | Browser default | Silent substitution | Controlled chain (§11.1) |
| Document font setting | `footer.fontFamily` free text | Footer only, unvalidated | **Violates §48** | Replace with catalog-backed ID (§11.5) |
| Header styles | Per-shell, inline Tailwind | 3 divergent impls | Drift | Converge (§16) |
| Footer styles | `AppConfig.footer{text,fontFamily,fontSize}` | Partly centralized | Font unvalidated | Keep text/size, gate font |

---

## 5. Baseline capture (§6) — status

**Partially satisfied.** 21 documents were rendered against the live database in
headless Chrome earlier today, with per-page probes for logo presence and
dimensions; artifacts are in the session scratchpad (`docs-after/`).

**Not yet captured:** page counts, file sizes, render times, unused-area
percentage, orphan-heading counts, split-table counts, font substitutions.
Those require true PDF generation, which needs a headless-Chrome
`--print-to-pdf` harness. That harness does not exist in this repo and is
itself a new dependency (D1). §6 baselines cannot be completed until D1 is
decided.

I will not fabricate baseline metrics.

---

## 6. Decisions required before implementation

### D1 — Rendering architecture (§8 decision gate)

| Option | Benefits | Risks | Migration cost | Compatibility | 
|---|---|---|---|---|
| **A. Keep browser print, improve CSS** | No new deps; zero regression risk; fastest | §25.2/§25.3 unachievable; no DOCX/email; no visual regression tests; output varies by user browser | Low | Full |
| **B. Add headless Chrome (Puppeteer) server-side** | Deterministic PDF; enables §40 visual regression + §6 baselines; keeps HTML templates | ~300 MB dep; Vercel serverless needs `@sparticuz/chromium`; cold starts; cost | Medium | High |
| **C. Add a PDF library (pdfmake/React-PDF)** | Full control: bookmarks, metadata, embedded fonts | Rewrite every template; loses HTML/Tailwind; highest regression risk to protected systems | **Very high** | Low |
| **D. B + `docx` library for DOCX** | Satisfies §25.3 | Second renderer to maintain; DOCX ≠ PDF pagination | High | Medium |

**My recommendation: B, then D if DOCX is genuinely required.** B is the smallest
step that unlocks the directive's *verification* requirements (§6, §40, §41)
without rewriting templates. C is not justified by evidence — §8 explicitly says
do not rewrite the renderer without proof the current one cannot satisfy the
requirements, and browser-print HTML can satisfy most layout requirements.

### D2 — Protected systems (Estimates & Schedule)

`docs/protected-systems.md` forbids internal changes without written approval.
The directive requires shared tokens, a shared pagination engine, and removal of
hardcoded branding — all of which live inside those systems.

Options: **(i)** exempt them and document the exception (§1 allows a documented
technical exception); **(ii)** grant written approval to modify them; **(iii)**
approve only the branding fixes (the `ZENARCH` leaks) and exempt layout.

**My recommendation: (iii) now, (ii) later** — fix the two multi-tenant branding
leaks immediately under narrow approval, defer engine unification until the
shared engine is proven on unprotected templates.

### D3 — Scope of §1's document list

~20 types don't exist. Building all of them is a large product programme, not a
redesign. Options: build all; build a prioritized subset (§42 Phase 5 order:
proposal, letter, memo, change order, punch list, minutes, field report); or
build the shared system + migrate existing templates only.

**My recommendation: shared system + existing templates + the four missing
Phase-5 types (letter, memo, field report, and a generic custom document).**

### D4 — Font licensing

Inter, Source Sans 3, IBM Plex Sans, Roboto and Noto Sans are OFL/Apache and
embeddable. **Aptos is Microsoft-proprietary**; **Helvetica Neue is licensed
(Linotype/Monotype)**. §11 requires `licenseVerified`. I cannot ship those two as
embeddable without a licence you hold. Recommendation: ship the five open fonts
as `bundled`, mark Helvetica/Arial `system` (no embedding), and mark Aptos
`disabled` pending a licence.

---

## 7. Honest scope assessment

This directive specifies a document-generation platform: normalized model,
token system, font catalog, settings area, pagination engine, five renderers,
40 document types, validation engine, diagnostics, visual regression, a 16-item
sample pack in every format, and a baseline-vs-final report.

Against a codebase with **no PDF library, no DOCX library, no font system, no
document model, and ~20 of the required document types missing**, this is a
multi-week programme. It cannot be delivered in one pass, and I will not
represent partial work as complete (§48).

What I will do is work the phases in order, deliver evidence at each gate, and
state precisely what is and is not done — starting with the four decisions above,
because each one changes what gets built.
