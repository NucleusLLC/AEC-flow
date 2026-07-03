/**
 * Team invitations + seat enforcement. SERVER-ONLY.
 *
 * Seats = users in the company. A company can invite up to `seatLimit` total
 * (existing members + pending invites). Invitation is not tenant-scoped by the
 * query extension (accept happens pre-session, by token), so owner-facing reads
 * scope by companyId here.
 */
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { addDays } from "date-fns";
import { prisma } from "@/lib/db";
import { getCurrentCompanyId, getCurrentCompany } from "@/lib/server/tenant";
import type { UserRole } from "@prisma/client";

const INVITE_TTL_DAYS = 14;

export type SeatUsage = { used: number; pending: number; limit: number; available: number };

export async function getSeatUsage(): Promise<SeatUsage> {
  const companyId = await getCurrentCompanyId();
  const company = await getCurrentCompany();
  const limit = company?.seatLimit ?? 0;
  if (!companyId) return { used: 0, pending: 0, limit, available: 0 };
  const [used, pending] = await Promise.all([
    prisma.user.count({ where: { companyId } }),
    prisma.invitation.count({ where: { companyId, status: "PENDING" } }),
  ]);
  return { used, pending, limit, available: Math.max(0, limit - used - pending) };
}

export type InviteRow = {
  id: string;
  email: string;
  role: UserRole;
  token: string;
  createdAt: string;
  expiresAt: string | null;
};

export async function listInvitations(): Promise<InviteRow[]> {
  const companyId = await getCurrentCompanyId();
  if (!companyId) return [];
  const invites = await prisma.invitation.findMany({
    where: { companyId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  return invites.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    token: i.token,
    createdAt: i.createdAt.toISOString().slice(0, 10),
    expiresAt: i.expiresAt ? i.expiresAt.toISOString().slice(0, 10) : null,
  }));
}

type CreateResult = { ok: true; token: string } | { ok: false; error: string };

export async function createInvitation(emailRaw: string, role: UserRole, invitedByName?: string): Promise<CreateResult> {
  const companyId = await getCurrentCompanyId();
  if (!companyId) return { ok: false, error: "No company context." };
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };

  const usage = await getSeatUsage();
  if (usage.available <= 0) {
    return { ok: false, error: "No seats available — raise the seat limit or revoke a pending invite." };
  }

  // Already a member of THIS company?
  const existingMember = await prisma.user.findFirst({ where: { email, companyId }, select: { id: true } });
  if (existingMember) return { ok: false, error: "That person is already a member of this company." };

  // Reuse an existing pending invite for the same email (refresh its token/expiry).
  const existingInvite = await prisma.invitation.findFirst({ where: { companyId, email, status: "PENDING" } });
  const token = randomBytes(24).toString("hex");
  const expiresAt = addDays(new Date(), INVITE_TTL_DAYS);

  if (existingInvite) {
    await prisma.invitation.update({ where: { id: existingInvite.id }, data: { role, token, expiresAt } });
  } else {
    await prisma.invitation.create({
      data: { companyId, email, role, token, status: "PENDING", invitedByName: invitedByName ?? null, expiresAt },
    });
  }
  return { ok: true, token };
}

export async function revokeInvitation(id: string): Promise<void> {
  const companyId = await getCurrentCompanyId();
  if (!companyId) return;
  await prisma.invitation.updateMany({ where: { id, companyId, status: "PENDING" }, data: { status: "REVOKED" } });
}

export type InviteInfo = { companyName: string; email: string; role: UserRole };

/** Unauthenticated lookup for the accept page. Returns null if invalid/expired. */
export async function getInvitationByToken(token: string): Promise<InviteInfo | null> {
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!inv || inv.status !== "PENDING") return null;
  if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) return null;
  const company = await prisma.company.findUnique({ where: { id: inv.companyId }, select: { name: true } });
  if (!company) return null;
  return { companyName: company.name, email: inv.email, role: inv.role };
}

type AcceptResult = { ok: true; email: string } | { ok: false; error: string };

/** Unauthenticated: the invitee sets their name + password and joins the company. */
export async function acceptInvitation(token: string, name: string, password: string): Promise<AcceptResult> {
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!inv || inv.status !== "PENDING") return { ok: false, error: "This invite is no longer valid." };
  if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) return { ok: false, error: "This invite has expired." };
  if (!name.trim()) return { ok: false, error: "Enter your name." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  // Seat re-check at acceptance (the limit may have changed since the invite).
  const [company, used] = await Promise.all([
    prisma.company.findUnique({ where: { id: inv.companyId }, select: { seatLimit: true } }),
    prisma.user.count({ where: { companyId: inv.companyId } }),
  ]);
  if (company && used >= company.seatLimit) {
    return { ok: false, error: "This company has no seats available. Ask the owner to free a seat." };
  }

  const existing = await prisma.user.findUnique({ where: { email: inv.email }, select: { id: true } });
  if (existing) return { ok: false, error: "An account with this email already exists — sign in instead." };

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.create({
      data: {
        email: inv.email,
        name: name.trim(),
        passwordHash,
        role: inv.role,
        status: "ACTIVE",
        companyId: inv.companyId,
      },
    }),
    prisma.invitation.update({ where: { id: inv.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } }),
  ]);
  return { ok: true, email: inv.email };
}
