/**
 * Applying a SECOND proposal to a form the user may already have touched.
 *
 * WHY THIS EXISTS. Intake now proposes twice: once from the filename the moment
 * a file is dropped (instant, no network), and again once the server has read
 * the PDF's title block (a second or two later). The second proposal is better
 * — a labelled title block beats a filename at every field — but by the time it
 * lands the user may already be typing into the form, and silently overwriting
 * what someone just typed is the one behaviour that would make them stop
 * trusting the screen.
 *
 * THE RULE, in one sentence: a field the user has changed is theirs, everything
 * else follows the current proposal.
 *
 * `edited` is recomputed rather than carried forward, because `edited` is not a
 * record of keystrokes — it is the audit's claim that the saved value differs
 * from what the machine proposed, and that is the per-field error signal the
 * whole extraction audit exists to collect (feasibility doc §7). If the user
 * types `A-204` and the title block then proposes `A-204`, nobody corrected
 * anything and the audit must not say they did.
 *
 * PURE. No React, no I/O — it is called from a client component and from tests.
 */

import { DRAFT_FIELD_KEYS, type DraftFieldKey, type DrawingMetadataDraft } from "./types";

/** The editable form's values, one string per proposable field. */
export type ProposalValues = Record<DraftFieldKey, string>;

export type ApplyProposalInput = {
  /** What is in the form right now. */
  values: ProposalValues;
  /** Fields the user has changed away from the previous proposal. */
  edited: readonly DraftFieldKey[];
  /** The new, better proposal. */
  next: DrawingMetadataDraft;
};

export type ApplyProposalResult = {
  values: ProposalValues;
  edited: DraftFieldKey[];
};

/** The value a draft proposes for one field, as the form would hold it. */
export function proposedValue(draft: DrawingMetadataDraft, key: DraftFieldKey): string {
  const field = draft?.[key];
  return field ? String(field.value ?? "") : "";
}

/**
 * Merge a new proposal into the form.
 *
 * - An edited field keeps the user's value.
 * - An untouched field takes the new proposal, INCLUDING when the new proposal
 *   is empty: the second draft is a superset of the first (the filename draft is
 *   always one of its inputs), so an empty value there means the extractor
 *   genuinely retracted a guess, and leaving a stale guess on screen would be
 *   worse than showing the blank the register is happy to hold.
 * - `edited` is then re-derived by comparing each kept value to the new proposal.
 */
export function applyProposal({ values, edited, next }: ApplyProposalInput): ApplyProposalResult {
  const touched = new Set(edited);
  const merged = { ...values } as ProposalValues;
  const stillEdited: DraftFieldKey[] = [];

  for (const key of DRAFT_FIELD_KEYS) {
    const proposal = proposedValue(next, key);
    if (!touched.has(key)) {
      merged[key] = proposal;
      continue;
    }
    if ((merged[key] ?? "") !== proposal) stillEdited.push(key);
  }

  return { values: merged, edited: stillEdited };
}
