# Construction Contract Generator — plan

Take a template contract the practice already uses, the facts of one job, and
produce a finished, typeset, paginated construction contract that can be read,
corrected, signed and printed — without anybody retyping a clause.

---

## What this is, in one paragraph

The practice uploads its own contract as a PDF. For a given project, the user
fills in the deal facts — parties, site, contract sum, payment phases, dates.
Claude reads the template and returns the SAME contract with only the variable
facts replaced, as structured JSON. The app typesets that JSON on the practice
letterhead and paginates it through the document engine this app already owns.
The result is editable, storable, printable, and attached to the project.

**The AI edits. It does not author.** A generator that writes its own clauses
produces a document a practice cannot sign, because nobody has approved the
words. The template's wording, numbering, clause order and obligations survive
intact; only the facts move.

---

## What it rides on, and what is new

| Concern | Already in AEC-flow | New here |
| --- | --- | --- |
| Page geometry, `@page`, footers, `P i of P n` | `PrintSurface` + `PageRules` | — |
| **Page overflow** — the measuring pass, heading pushes, keep-together | `PagedPreview` (749 lines) + pure cut arithmetic in `lib/documents/pagination.ts` | contract atoms: the payment schedule, signature cards, a clause block |
| Letterhead, practice settings, fonts | `DocumentLetterhead`, `getPracticeSettings` | — |
| Private file storage, signed URLs | `lib/server/storage.ts` (the drawings bucket) | a `contracts/` prefix for template PDFs |
| Anthropic key, server-side | `lib/server/ai-config.ts` | the streaming call and its progress protocol |
| Money, exactly | `lib/proposals/engine/money.ts` | phase allocation to the cent |

**The page-overflow layer is the app's own engine, not a second one.** A
fixed-height-sheet paginator (the shape the `page-overflow` skill describes for
retrofits) would be a second, competing model of a page in an app that already
has one that is measured, tested and shared by seventeen documents. The contract
is a flowing document with a letterhead and a footer — exactly what the existing
engine was built for. What the contract adds is its own *atoms*: blocks the pass
must never split.

---

## Decisions taken up front

**The template goes to the model as a PDF document block, not as scraped text.**
Layout, numbering and clause structure are part of what it has to preserve, and
a text dump throws all three away.

**The figures are the app's, never the model's.** Percentages, amounts and the
exchange rate are computed here in integer cents, with the rounding remainder on
the last phase so the column sums to the contract sum exactly. The model is told
the numbers; it never calculates one.

**Nothing is invented.** Anything the user did not supply comes back as
`__________` in the document, and the model lists it in `check`. A contract with
a plausible-looking wrong date is worse than one with a blank.

**The document is stored as STRUCTURED JSON, not as HTML.** Sigma-CMS stores a
self-contained HTML file because it is a single-file app with nowhere else to
put it. Here the contract is a row; the typesetting is a React render of that
row, so a change to the letterhead or the footer fixes every contract ever made
rather than none of them. The print route re-renders and re-paginates.

**Generation runs server-side.** The Anthropic key stays on the server
(`lib/server/ai-config.ts`), so the browser never holds it and the
`anthropic-dangerous-direct-browser-access` header is not needed. Progress
reaches the browser over SSE.

**Progress is measured, never mimed.** The model reports none, so the bar is
built from things that can be counted: bytes of the template read, characters
received against an expected length, and the sections that have actually arrived
in the partial JSON. The bar is monotonic and only shows 100% when the document
is on screen.

---

## Stages

### CG-1 — the document *(this release)*

- `contract_templates` (the practice's own PDFs) and `construction_contracts`
  (one row per generated contract, numbered `CC-YYYY-NNN`).
- The pure domain: phase allocation to the cent, the pre-flight checklist, the
  emphasis rules, the shape recognition (clause titles, `Label: value` cards and
  tables, signature blocks).
- The server call: template as a document block, facts as labelled lines,
  structured output, streaming with a real progress protocol.
- The screens: register, the new-contract form with its pre-flight checklist and
  live progress, the contract itself (read, edit, review box), and the print
  route on the practice letterhead with the schedule as one keep-together block.

### CG-2 — after it has been used on a real job

- Revisions: supersede rather than overwrite, and a diff against the previous
  version.
- Send for signature (the app already sends through Resend).
- Contract → invoice: raise the payment phases as invoice milestones, which the
  finance module already understands.

## Not in scope

Authoring a contract from nothing, clause libraries, negotiating red-lines
between two parties (that is the Drawing Studio's shape, on a different
document), and anything that reads as legal advice. The practice's template is
the practice's; this fills it in.
