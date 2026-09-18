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
 * recipient, copies, subject, body, the document's name, which entity it relates
 * to, and any files chosen in the file picker. There is deliberately no
 * companyId, no sender name and no `from` — those are resolved from the
 * signed-in user's own database row and the environment. Adding any of them to
 * this type would be the bug.
 *
 * Attachments arrive as base64 because this app generates no PDF: the file is
 * one the sender printed from a Print / Preview screen and chose by hand. Their
 * type, size and name are decided in lib/email/attachments.ts, from the
 * extension rather than from anything the browser claimed, and the request body
 * limit that has to accommodate them is set in next.config.ts — the two move
 * together, or a file inside the app's own limit is refused by the framework
 * before a word of it is read.
 */

import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
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
  attachments?: { filename: string; content: string; contentType?: string; bytes?: number }[];
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
    attachments: input.attachments,
  });
}

export type EmailHistory = {
  entries: EmailLogEntry[];
  /** True when these are the whole company's sends rather than one document's. */
  companyWide: boolean;
  /** Set when a company-wide read was refused: the caller is not an administrator.
   *  Distinguishes "you may not see this" from "there is nothing to see". */
  denied?: boolean;
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
  /* A COMPANY-WIDE read is administrators only — it exposes the practice's whole
   * correspondence, bodies included. A DOCUMENT-SCOPED read stays open to any
   * signed-in user: it answers "did the thing I just sent actually go?", which is
   * the question this module exists for, and it is limited to one document.
   *
   * Enforced here rather than only on the page, because a server action is a public
   * endpoint — anything reachable from the browser can call it directly. */
  if (!scoped) {
    try {
      const actor = await requireActor();
      if (!canManagePasswords(actor.role, actor.isFounder)) {
        return { entries: [], companyWide: true, denied: true };
      }
    } catch {
      return { entries: [], companyWide: true, denied: true };
    }
  }
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
