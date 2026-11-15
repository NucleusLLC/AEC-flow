/**
 * Service Proposal client acceptance by secure link (Release C) — data access. SERVER-ONLY.
 *
 * Two kinds of caller, the /pay/<token> split (lib/data/pay-now.ts):
 *
 *  - A signed-in member on the proposal's detail page: create a link, revoke it, list the
 *    links and the answers given through them. The tenant extension scopes everything.
 *
 *  - The client on /p/<token>, with NO session. The first lookup — by token hash — is a raw
 *    query that bypasses the tenant extension on purpose and returns ONLY the link id and its
 *    company. Everything after that runs inside that company (`companyOverride()` on the
 *    page, `runAsCompany()` in the server action), so every read and write is still scoped
 *    by lib/db.ts, exactly like the office TV board and the pay page.
 *
 * THE ANSWER goes through `transitionStatus` in lib/data/service-proposals.ts — the same
 * status machine, lock stamp and history row staff use. Claiming the link (an updateMany
 * guarded on "still unanswered, unrevoked, unexpired") runs inside that transaction, so a
 * double submit, a concurrent revoke or a staff status change in between leaves exactly one
 * outcome and never a link marked answered on a proposal that did not move.
 *
 * Pure rules (token, expiry, which statuses, the form) live in lib/proposals/acceptance.ts.
 */
import "server-only";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { getServiceProposal, transitionStatus } from "@/lib/data/service-proposals";
import { sendEmail } from "@/lib/server/email";
import { publicBaseUrl } from "@/lib/payments/pay-link";
import {
  acceptanceLinkExpiry,
  acceptanceLinkState,
  acceptanceUrl,
  canApplyDecision,
  decisionHistoryReason,
  decisionTargetStatus,
  generateAcceptanceToken,
  hashAcceptanceToken,
  isClientAcceptable,
  isClientDecision,
  isRevocable,
  type AcceptanceForm,
  type ClientDecision,
  type DeclineForm,
  type LinkState,
} from "@/lib/proposals/acceptance";
import { InvalidTransitionError, STATUS_LABEL } from "@/lib/proposals/engine/status";
import type { ServiceProposalDTO } from "@/lib/proposals/dto";

/** A refusal the staff screen can show as is. */
export class AcceptanceLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AcceptanceLinkError";
  }
}

export type AcceptanceLinkStatus = "active" | "expired" | "revoked" | "answered";

/** One link as the practice sees it on the detail page. Never carries the token or its hash. */
export type AcceptanceLinkSummary = {
  id: string;
  status: AcceptanceLinkStatus;
  versionLabel: string | null;
  revision: number;
  createdAt: string;
  createdByName: string | null;
  expiresAt: string;
  revokedAt: string | null;
  decision: ClientDecision | null;
  decidedAt: string | null;
  signerName: string | null;
  signerTitle: string | null;
  signerCompany: string | null;
  signature: string | null;
  declineReason: string | null;
  decisionIp: string | null;
  decisionUserAgent: string | null;
};

// ── Signed-in (detail page) ───────────────────────────────────────────────────

/** Every link made for a proposal, newest first. */
export async function listAcceptanceLinks(serviceProposalId: string): Promise<AcceptanceLinkSummary[]> {
  const rows = await prisma.serviceProposalAcceptanceLink.findMany({
    where: { serviceProposalId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const now = new Date();
  return rows.map((r) => {
    const decision = isClientDecision(r.decision) ? r.decision : null;
    const status: AcceptanceLinkStatus = decision
      ? "answered"
      : r.revokedAt
        ? "revoked"
        : isRevocable(r, now)
          ? "active"
          : "expired";
    return {
      id: r.id,
      status,
      versionLabel: r.versionLabel,
      revision: r.revision,
      createdAt: r.createdAt.toISOString(),
      createdByName: r.createdByName,
      expiresAt: r.expiresAt.toISOString(),
      revokedAt: r.revokedAt?.toISOString() ?? null,
      decision,
      decidedAt: r.decidedAt?.toISOString() ?? null,
      signerName: r.signerName,
      signerTitle: r.signerTitle,
      signerCompany: r.signerCompany,
      signature: r.signature,
      declineReason: r.declineReason,
      decisionIp: r.decisionIp,
      decisionUserAgent: r.decisionUserAgent,
    };
  });
}

/**
 * Create a link for an issued proposal, retiring any earlier unanswered one — only the
 * newest link works, as with password resets. Returns the URL, which holds the token and
 * is never stored: the caller shows it once.
 */
export async function createAcceptanceLink(
  serviceProposalId: string,
): Promise<{ url: string; expiresAt: string }> {
  const p = await prisma.serviceProposal.findFirst({
    where: { id: serviceProposalId, deletedAt: null },
    select: { id: true, companyId: true, status: true, revision: true, versionLabel: true, validUntil: true },
  });
  if (!p) throw new AcceptanceLinkError("Proposal not found.");
  if (!p.companyId) throw new AcceptanceLinkError("This proposal belongs to no practice and cannot be shared.");
  if (!isClientAcceptable(p.status)) {
    throw new AcceptanceLinkError(
      `Only a proposal that has been sent to the client can be shared for acceptance (this one is "${STATUS_LABEL[p.status]}").`,
    );
  }
  const now = new Date();
  const expiresAt = acceptanceLinkExpiry(now, p.validUntil ? p.validUntil.toISOString().slice(0, 10) : null);
  if (!expiresAt) {
    throw new AcceptanceLinkError("This proposal’s validity date has passed. Extend it or revise the proposal first.");
  }

  const session = await getServerSession(authOptions);
  const token = generateAcceptanceToken();
  const companyId = p.companyId;
  await prisma.$transaction(async (tx) => {
    await tx.serviceProposalAcceptanceLink.updateMany({
      where: { serviceProposalId: p.id, decision: null, revokedAt: null },
      data: { revokedAt: now },
    });
    await tx.serviceProposalAcceptanceLink.create({
      data: {
        companyId,
        serviceProposalId: p.id,
        tokenHash: hashAcceptanceToken(token),
        revision: p.revision,
        versionLabel: p.versionLabel,
        expiresAt,
        createdById: session?.user?.id ?? null,
        createdByName: session?.user?.name ?? null,
      },
    });
  });
  return { url: acceptanceUrl(process.env, token), expiresAt: expiresAt.toISOString() };
}

/** Revoke an unanswered link. An answered one is a record and stays. False when nothing changed. */
export async function revokeAcceptanceLink(serviceProposalId: string, linkId: string): Promise<boolean> {
  const r = await prisma.serviceProposalAcceptanceLink.updateMany({
    where: { id: linkId, serviceProposalId, decision: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return r.count > 0;
}

// ── Public (/p/<token>, no session) ───────────────────────────────────────────

/**
 * /p/<token> → the link and its company, or null. RAW on purpose (see the file note): the
 * visitor has no session and may be signed in to a different practice. Callers check the
 * token's shape first. Finds the row whatever its state — whether it is still usable is
 * decided afterwards, so an unknown and a dead token end in the same page.
 */
export async function resolveAcceptanceToken(token: string): Promise<{ linkId: string; companyId: string } | null> {
  const rows = await prisma.$queryRaw<{ linkId: string; companyId: string | null }[]>`
    SELECT "id" AS "linkId", "companyId"
    FROM "service_proposal_acceptance_links"
    WHERE "tokenHash" = ${hashAcceptanceToken(token)}
    LIMIT 1`;
  const r = rows[0];
  return r && r.companyId ? { linkId: r.linkId, companyId: r.companyId } : null;
}

/** What the public page may know about a link: the answer, never who made the link. */
export type PublicAcceptance = {
  state: LinkState;
  proposal: ServiceProposalDTO | null;
  decision: ClientDecision | null;
  decidedAt: string | null;
  signerName: string | null;
  signerTitle: string | null;
  signerCompany: string | null;
  versionLabel: string | null;
};

const INVALID: PublicAcceptance = {
  state: "invalid",
  proposal: null,
  decision: null,
  decidedAt: null,
  signerName: null,
  signerTitle: null,
  signerCompany: null,
  versionLabel: null,
};

/** Load a link for the public page. MUST run inside the link's company (see the file note). */
export async function loadPublicAcceptance(linkId: string): Promise<PublicAcceptance> {
  const link = await prisma.serviceProposalAcceptanceLink.findFirst({ where: { id: linkId } });
  if (!link) return INVALID;
  const proposal = await getServiceProposal(link.serviceProposalId);
  const state = acceptanceLinkState(
    link,
    proposal
      ? { status: proposal.status, revision: proposal.revision, versionLabel: proposal.versionLabel, deletedAt: null }
      : null,
    new Date(),
  );
  if (state === "invalid" || !proposal) return INVALID;
  return {
    state,
    proposal,
    decision: isClientDecision(link.decision) ? link.decision : null,
    decidedAt: link.decidedAt?.toISOString() ?? null,
    signerName: link.signerName,
    signerTitle: link.signerTitle,
    signerCompany: link.signerCompany,
    versionLabel: link.versionLabel,
  };
}

/** Thrown inside the transaction when the link was answered or revoked a moment earlier. */
class LinkNoLongerOpenError extends Error {}

export type DecisionOutcome = { ok: true; decision: ClientDecision } | { ok: false; reason: "invalid" | "error" };

/**
 * Record the client's answer and move the proposal. MUST run inside the link's company.
 * Never throws: every failure is an outcome the page can show.
 */
export async function recordClientDecision(
  linkId: string,
  answer:
    | { decision: "ACCEPTED"; form: AcceptanceForm }
    | { decision: "DECLINED"; form: DeclineForm },
  meta: { ip: string | null; userAgent: string | null },
): Promise<DecisionOutcome> {
  try {
    const link = await prisma.serviceProposalAcceptanceLink.findFirst({ where: { id: linkId } });
    if (!link) return { ok: false, reason: "invalid" };
    const proposal = await getServiceProposal(link.serviceProposalId);
    const now = new Date();
    const state = acceptanceLinkState(
      link,
      proposal
        ? { status: proposal.status, revision: proposal.revision, versionLabel: proposal.versionLabel, deletedAt: null }
        : null,
      now,
    );
    if (state !== "open" || !proposal || !canApplyDecision(proposal.status, answer.decision)) {
      return { ok: false, reason: "invalid" };
    }

    const signer =
      answer.decision === "ACCEPTED"
        ? { name: answer.form.name, title: answer.form.title, company: answer.form.company }
        : { name: answer.form.name ?? "", title: null, company: null };
    const reason = decisionHistoryReason(
      answer.decision,
      signer,
      link.versionLabel,
      answer.decision === "DECLINED" ? answer.form.reason : null,
    );

    await transitionStatus(proposal.id, decisionTargetStatus(answer.decision), reason, {
      by: { id: null, name: signer.name ? `${signer.name} (client)` : "Client" },
      alsoInTransaction: async (tx) => {
        const claimed = await tx.serviceProposalAcceptanceLink.updateMany({
          where: { id: link.id, decision: null, revokedAt: null, expiresAt: { gt: now } },
          data: {
            decision: answer.decision,
            decidedAt: now,
            signerName: signer.name || null,
            signerTitle: signer.title ?? null,
            signerCompany: signer.company ?? null,
            signature: answer.decision === "ACCEPTED" ? answer.form.signature : null,
            declineReason: answer.decision === "DECLINED" ? answer.form.reason : null,
            decisionIp: meta.ip,
            decisionUserAgent: meta.userAgent,
          },
        });
        if (claimed.count !== 1) throw new LinkNoLongerOpenError();
      },
    });

    await notifyPractice(proposal, answer.decision, signer, now);
    return { ok: true, decision: answer.decision };
  } catch (e) {
    if (e instanceof LinkNoLongerOpenError || e instanceof InvalidTransitionError) {
      return { ok: false, reason: "invalid" };
    }
    console.error("[proposal-acceptance] could not record the client's answer", e);
    return { ok: false, reason: "error" };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Tell the proposal's owner (else its author) that the client answered. Through the
 * guarded sender, soft: an unconfigured mailer or a missing address is logged, never thrown —
 * the answer is already recorded and shows on the detail page either way.
 */
async function notifyPractice(
  proposal: ServiceProposalDTO,
  decision: ClientDecision,
  signer: { name: string; title: string | null; company: string | null },
  at: Date,
): Promise<void> {
  try {
    const row = await prisma.serviceProposal.findFirst({
      where: { id: proposal.id },
      select: { ownerId: true, createdById: true, companyId: true },
    });
    const userId = row?.ownerId || row?.createdById;
    if (!row?.companyId || !userId) return;
    // User is not a tenant model: scope it by hand, as every team query does.
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId: row.companyId, status: { not: "INACTIVE" } },
      select: { email: true, name: true },
    });
    if (!user?.email) return;

    const verb = decision === "ACCEPTED" ? "accepted" : "declined";
    const who = [signer.name || "The client", [signer.title, signer.company].filter(Boolean).join(", ")]
      .filter(Boolean)
      .join(" — ");
    const link = `${publicBaseUrl(process.env)}/design/service-proposals/${proposal.id}`;
    const subject = `Proposal ${proposal.number} ${verb} by the client`;
    const html = `<p>${escapeHtml(who)} ${verb} proposal <strong>${escapeHtml(proposal.number)}</strong> — ${escapeHtml(proposal.title)}${proposal.versionLabel ? ` (version ${escapeHtml(proposal.versionLabel)})` : ""} through the client acceptance link, on ${escapeHtml(at.toISOString().slice(0, 16).replace("T", " "))} UTC.</p><p><a href="${escapeHtml(link)}">Open the proposal in AEC-flow</a></p>`;
    const sent = await sendEmail({ to: user.email, subject, html });
    if (!sent.ok) console.error(`[proposal-acceptance] owner notification not sent: ${sent.error}`);
  } catch (e) {
    console.error("[proposal-acceptance] owner notification failed", e);
  }
}
