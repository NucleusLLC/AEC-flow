/**
 * AEC-flow subscription billing — the database side.
 *
 * `Company` is not a tenant model (it IS the tenant), so nothing scopes these
 * queries for us: every read and write names the company id explicitly — the
 * caller's own (from requireActor) on the billing page, or the one the Stripe
 * webhook resolved. `BillingWebhookEvent` is a platform table (see schema).
 *
 * SERVER-ONLY.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { billingConfig } from "@/lib/billing/config";
import { retrieveSubscription } from "@/lib/billing/stripe";
import { parseBillingStatus, type BillingStatus } from "@/lib/billing/status";
import type { BillingStore, CompanyBillingRef, SubscriptionWrite } from "@/lib/billing/webhook";
import { companyOverride } from "@/lib/server/request-company";

const REF_SELECT = {
  id: true,
  stripeCustomerId: true,
  stripeSubscriptionId: true,
  subscriptionStatus: true,
} as const;

export type CompanyBilling = {
  id: string;
  name: string;
  plan: string;
  seatLimit: number;
  isFounder: boolean;
  stripeCustomerId: string | null;
  status: BillingStatus;
  priceId: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export async function getCompanyBilling(companyId: string): Promise<CompanyBilling | null> {
  const c = await prisma.company.findFirst({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      plan: true,
      seatLimit: true,
      isFounder: true,
      stripeCustomerId: true,
      subscriptionStatus: true,
      subscriptionPriceId: true,
      subscriptionCurrentPeriodEnd: true,
      subscriptionCancelAtPeriodEnd: true,
    },
  });
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    plan: c.plan,
    seatLimit: c.seatLimit,
    isFounder: c.isFounder,
    stripeCustomerId: c.stripeCustomerId,
    status: parseBillingStatus(c.subscriptionStatus),
    priceId: c.subscriptionPriceId,
    currentPeriodEnd: c.subscriptionCurrentPeriodEnd,
    cancelAtPeriodEnd: c.subscriptionCancelAtPeriodEnd,
  };
}

/** Active members, for the seats line. */
export async function countActiveMembers(companyId: string): Promise<number> {
  return prisma.user.count({ where: { companyId, status: { not: "INACTIVE" } } });
}

/** Link a newly created Stripe customer to the practice (only if none is linked yet). */
export async function saveStripeCustomerId(companyId: string, customerId: string): Promise<string> {
  await prisma.company.updateMany({ where: { id: companyId, stripeCustomerId: null }, data: { stripeCustomerId: customerId } });
  const row = await prisma.company.findFirst({ where: { id: companyId }, select: { stripeCustomerId: true } });
  return row?.stripeCustomerId ?? customerId;
}

/**
 * The status for the app-wide banner. Never throws: if 0033 has not been
 * applied yet, or anything else goes wrong, there is simply no banner.
 */
export async function getBillingBannerStatus(companyId: string | null | undefined): Promise<{ status: BillingStatus; isFounder: boolean } | null> {
  if (!companyId || !billingConfig()) return null;
  try {
    const c = await prisma.company.findFirst({
      where: { id: companyId },
      select: { subscriptionStatus: true, isFounder: true },
    });
    return c ? { status: parseBillingStatus(c.subscriptionStatus), isFounder: c.isFounder } : null;
  } catch {
    return null;
  }
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/** The Prisma-backed store the webhook route hands to handleBillingEvent. */
export function prismaBillingStore(secretKey: string): BillingStore {
  return {
    async hasEvent(eventId) {
      const row = await prisma.billingWebhookEvent.findFirst({ where: { id: eventId }, select: { id: true } });
      return !!row;
    },
    async recordEvent({ id, type, companyId }) {
      try {
        await prisma.billingWebhookEvent.create({ data: { id, type, billingCompanyId: companyId } });
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
      }
    },
    async findCompanyById(id): Promise<CompanyBillingRef | null> {
      return prisma.company.findFirst({ where: { id }, select: REF_SELECT });
    },
    async findCompanyByCustomerId(customerId): Promise<CompanyBillingRef | null> {
      return prisma.company.findFirst({ where: { stripeCustomerId: customerId }, select: REF_SELECT });
    },
    async updateCompany(companyId: string, data: SubscriptionWrite, eventAt: Date) {
      const res = await prisma.company.updateMany({
        where: {
          id: companyId,
          OR: [{ subscriptionEventAt: null }, { subscriptionEventAt: { lte: eventAt } }],
        },
        data: { ...data, subscriptionEventAt: eventAt },
      });
      return res.count > 0;
    },
    fetchSubscription(id) {
      return retrieveSubscription(secretKey, id);
    },
    onCompanyResolved(companyId) {
      // No session on a webhook: any tenant-scoped query made while handling it
      // belongs to this practice and nobody else (as app/officedash does).
      companyOverride().companyId = companyId;
    },
  };
}
