"use server";

/**
 * Server actions for outbound document email.
 *
 * Thin on purpose. All of the judgement — who the sender is, whether the
 * addresses are usable, whether the provider actually confirmed the send, and
 * what gets written to the record — lives in `lib/server/document-email.ts`,
 * where it can be unit-tested with the provider and the database mocked. An
 * action is a network boundary, not a place to put reasoning.
 *
 * SECURITY. The input type below is the whole of what the browser may influence:
 * recipient, copies, subject, body, the document's name and which entity it
 * relates to. There is deliberately no companyId, no sender name and no `from` —
 * those are resolved from the signed-in user's own database row and the
 * environment. Adding any of them to this type would be the bug.
 */

import {
  sendDocumentEmail,
  type SendDocumentEmailResult,
} from "@/lib/server/document-email";
import { listEmailLog, type EmailLogEntry } from "@/lib/data/email-log";

/** Exactly what a client may supply. See the SECURITY note above. */
export type ComposedEmail = {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  documentName: string;
  relatedType?: string | null;
  relatedId?: string | null;
  linkPath?: string | null;
};

export async function sendDocumentEmailAction(
  input: ComposedEmail,
): Promise<SendDocumentEmailResult> {
  // No try/catch that turns a throw into `ok: true` can exist here, because
  // there is no `ok: true` for this function to invent — the only success value
  // is the one `sendDocumentEmail` returns after the provider confirmed.
  return sendDocumentEmail({
    to: input.to,
    cc: input.cc,
    subject: input.subject,
    body: input.body,
    documentName: input.documentName,
    relatedType: input.relatedType,
    relatedId: input.relatedId,
    linkPath: input.linkPath,
  });
}

export type EmailHistory = {
  entries: EmailLogEntry[];
  /** True when these are the whole company's sends rather than one document's. */
  companyWide: boolean;
};

/**
 * The "Sent" history the compose dialog shows. With a related entity, that
 * entity's history; without one, the company's most recent sends — which is
 * still the answer to "did anything actually go out", and is what the modules
 * that do not yet pass a related entity fall back to.
 *
 * Company scoping is not applied here and must not be: `listEmailLog` reads
 * through the Prisma tenant extension (EmailLog is in TENANT_MODELS), so the
 * filter is added below this layer where no caller can omit it.
 */
export async function listEmailHistoryAction(opts?: {
  relatedType?: string | null;
  relatedId?: string | null;
  limit?: number;
}): Promise<EmailHistory> {
  const scoped = Boolean(opts?.relatedType && opts?.relatedId);
  try {
    const entries = await listEmailLog({
      relatedType: opts?.relatedType ?? null,
      relatedId: opts?.relatedId ?? null,
      limit: opts?.limit ?? 10,
    });
    return { entries, companyWide: !scoped };
  } catch {
    // A history that cannot load must not stop anyone composing a message.
    return { entries: [], companyWide: !scoped };
  }
}
