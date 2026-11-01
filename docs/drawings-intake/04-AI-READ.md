# Drawing intake — AI title-block reading and set splitting

Version 0.39.0. Extends 01-FEASIBILITY (the proposal-then-confirm rule),
02-STORAGE (staged objects) and 03-TITLE-BLOCK (the text-layer rules).

## What changed for the user

Drop a set, get sheets. A multi-page PDF (2–80 pages) is split into one
staged object per page, and every page is read as its own sheet: sheet number,
title, kind of drawing (floor plan, section, elevation …), revision and its
date, project name and number, and — new — the architect and the engineer the
title block names. Every value is still a proposal the user confirms; nothing
is written from a reading alone.

The reading now works on a scan. The text-layer rules (03) still run first and
still win an outright disagreement when they are label-anchored; a model then
LOOKS at the page and fills what the rules could not read, which on a scan or
an outlined plot is everything but the filename.

## Pieces

| Piece | Where | Pure? |
|---|---|---|
| Answer schema, prompt, answer → draft, merge policy | `lib/drawings/ai-read.ts` | yes (tested) |
| Which pages, what batches, what names | `lib/drawings/set-split.ts` | yes (tested) |
| Page extraction and title-block strip crops (pdf-lib) | `lib/server/pdf-pages.ts` | no |
| The model call | `lib/server/titleblock-ai.ts` | no |
| Orchestration (`analyseUploadedDrawing`, `splitDrawingSet`) | `lib/data/drawing-intake.ts` | no |
| Split loop, new fields, apply-to-all | `components/drawings/drawing-intake.tsx` | UI |

Schema: `architect`, `engineer`, `setFilename`, `setPage` on `drawings`
(`prisma/sql/0038_drawing_ai_intake.sql`, additive, apply before merge).

## How the model sees the sheet

A model shown an A1 sheet as one picture cannot read 2.5 mm lettering. So it is
shown three one-page PDFs of the same sheet: the whole page, then the
right-hand strip and the bottom strip of it CROPPED (media box and crop box
set to the strip), which the renderer draws at several times the
magnification. The strips are the same fractions `lib/drawings/region.ts`
uses to pick text-layer items — that is where title blocks live. Page rotation
is honoured so "right" and "bottom" are what the viewer sees.

The text-layer title-block text (when there is one) and the rules' own
proposal go along in the prompt, so the model confirms or corrects rather than
starting cold. The answer is structured output in `AI_READ_SCHEMA`: every field
is `{value, confidence, evidence}`, nullable, and `evidence` is the printed
text the value was read from, shown on the form exactly as a regex hit is.

Model: `claude-opus-5-5` with server-side fallback; medium effort; 60 s
timeout; one retry on connection errors. Cost lands per sheet (a few cents).

## Merge policy (`mergeAiRead`)

- Agree → one field, the rules' value, confidence raised by 0.06, both
  evidences kept.
- One side only → that side's field.
- Disagree → the more confident wins, the other is the first alternate, and
  the sheet gets a warning naming both. The model's confidence is capped at
  0.9, so a labelled rules hit (0.95) wins; a blind-scan guess (≤ 0.76) loses.
- Sheet type: the rules' answer stands when confident (≥ 0.8) or when the
  model agrees; otherwise the model's is offered as `sheetTypeSource: "ai"`.

## Fail-open

No key, timeout, refusal, oversize page, unparseable answer: the rules' draft
stands and the row says why ("No AI key is configured …"). `aiRead` in the
audit is true only when an answer was merged, so a later accuracy count can
separate "AI was wrong" from "AI was off".

## Set splitting

`shouldSplitSet`: 2–80 pages. The browser uploads the set once, analysis
reports the page count, the browser then calls `splitSet` in batches of four
pages (each call downloads the set again — functions keep nothing between
calls), replaces the set row with one row per page, discards the set object,
and analyses each page sequentially as any single upload. Pages carry
`setFilename` / `setPage` so a sheet can be traced to the set it came from.
Past 80 pages the set is filed as one drawing with a warning, as before — a
screen of 200 rows is not a review.

A split page has no bytes in the browser: if its staged object is lost before
confirm, the row says to re-drop the set rather than silently re-uploading.

## Not done

- No OCR text layer is written back into the split page; the page is the
  original page, untouched.
- The set itself is not kept. A practice that wants the bound set on file
  uploads it as a General Document.
- Revision-table history (every past revision and date) is not extracted —
  only the current row.
