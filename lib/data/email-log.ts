/**
 * The outbound-email record: writing an attempt, and reading it back.
 *
 * SERVER-ONLY (Prisma). Every function here goes through `prisma.emailLog`,
 * which `lib/db.ts` scopes to the signed-in user's company — `EmailLog` is in
 * TENANT_MODELS, so the extension injects `companyId` into every read and stamps
 * it onto every write. Nothing in this file passes a companyId by hand, and
 * nothing accepts one from a caller.
 *
 * NOTE the deliberate absence of `findUnique`: reads use `findMany`/`findFirst`
 * so the tenant filter is a real database predicate rather than the extension's
 * post-hoc row guard (see lib/tenant-scope-findunique.test.ts).
 */
import { prisma } from "@/lib/db";
import type { EmailStatus } from "@prisma/client";

/** Longest text we will store in any single column, so one paste cannot bloat a row. */
const MAX_FIELD = 20_000;
/** Longest address text stored — a rejected raw recipient can be arbitrary garbage. */
const MAX_ADDRESS = 500;

export type EmailAttempt = {
  senderId: string | null;
  senderName: string;
  senderEmail: string;
  /** Recipient as handed to the provider, or the raw text that failed validation. */
  to: string;
  cc: string[];
  subject: string;
  body: string;
  relatedType: string | null;
  relatedId: string | null;
  documentName: string | null;
  /** Present ONLY when the provider accepted the message. */
  providerMessageId: string | null;
  status: EmailStatus;
  /** The failure text. Null when SENT. */
  error: string | null;
};

export type EmailLogEntry = {
  id: string;
  to: string;
  cc: string[];
  subject: string;
  body: string;
  senderName: string;
  documentName: string | null;
  relatedType: string | null;
  relatedId: string | null;
  status: EmailStatus;
  error: string | null;
  providerMessageId: string | null;
  createdAt: Date;
};

/**
 * Write one attempt. Returns the new row's id, or null if the write itself
 * failed.
 *
 * IT DOES NOT THROW. A caller reaches this line having already learned whether
 * the message went out; letting a logging failure become the caller's exception
 * would turn a delivered email into a reported error — which is the mirror image
 * of the bug this module exists to prevent, and just as misleading. The caller
 * surfaces the null instead ("sent, but the record could not be written").
 */
export async function recordEmailAttempt(attempt: EmailAttempt): Promise<string | null> {
  try {
    const row = await prisma.emailLog.create({
      data: {
        senderId: attempt.senderId,
        senderName: clamp(attempt.senderName, 200),
        senderEmail: clamp(attempt.senderEmail, MAX_ADDRESS),
        to: clamp(attempt.to, MAX_ADDRESS),
        cc: attempt.cc.map((a) => clamp(a, MAX_ADDRESS)),
        subject: clamp(attempt.subject, 500),
        body: clamp(attempt.body, MAX_FIELD),
        relatedType: attempt.relatedType ? clamp(attempt.relatedType, 60) : null,
        relatedId: attempt.relatedId ? clamp(attempt.relatedId, 200) : null,
        documentName: attempt.documentName ? clamp(attempt.documentName, 300) : null,
        providerMessageId: attempt.providerMessageId,
        status: attempt.status,
        error: attempt.error ? clamp(attempt.error, 2_000) : null,
      },
      select: { id: true },
    });
    return row.id;
  } catch {
    return null;
  }
}

/**
 * The "Sent" history. With a related entity, the history for THAT document;
 * without one, the company's most recent sends.
 *
 * Failures are included and are the point — the question this answers is "did it
 * actually go out", and a list that shows only successes cannot answer it.
 */
export async function listEmailLog(opts?: {
  relatedType?: string | null;
  relatedId?: string | null;
  limit?: number;
}): Promise<EmailLogEntry[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 20, 1), 100);
  const where =
    opts?.relatedType && opts?.relatedId
      ? { relatedType: opts.relatedType, relatedId: opts.relatedId }
      : {};
  return prisma.emailLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      to: true,
      cc: true,
      subject: true,
      body: true,
      senderName: true,
      documentName: true,
      relatedType: true,
      relatedId: true,
      status: true,
      error: true,
      providerMessageId: true,
      createdAt: true,
    },
  });
}

function clamp(s: string, max: number): string {
  const v = (s ?? "").toString();
  return v.length > max ? v.slice(0, max) : v;
}
