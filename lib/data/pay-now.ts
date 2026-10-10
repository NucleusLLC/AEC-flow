/**
 * "Pay online" — data access. SERVER-ONLY.
 *
 * Two kinds of caller:
 *
 *  - A signed-in member (Settings, the invoice page, the printed invoice). The
 *    tenant extension scopes everything as usual.
 *
 *  - A caller with NO session: the client opening /pay/<token>, and the Stripe
 *    webhook. They do not yet know which practice they belong to, so the first
 *    lookup — by pay token, or by the invoice id in a signed Stripe event — is a
 *    raw query that bypasses the tenant extension on purpose and returns ONLY the
 *    invoice id and its company. Everything after that runs inside that company
 *    (`companyOverride()` on a page, `runAsCompany()` in a route handler), exactly
 *    like the office TV board.
 *
 * Company is not a tenant model (it is the tenant), so its Stripe columns are
 * read and written directly, always by an explicit company id.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { currentCompanyId } from "@/lib/server/request-company";
import { isCardCurrencySupported, isOnlinePayable, newPayToken, payUrl, publicBaseUrl } from "@/lib/payments/pay-link";
import { stripeConfig, type ConnectStatus } from "@/lib/payments/stripe";
import type { InvoiceForPayment } from "@/lib/payments/webhook";

export type OnlinePaymentsStatus = {
  /** STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are both set on this deployment. */
  configured: boolean;
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  statusAt: string | null;
};

const STATUS_SELECT = {
  stripeAccountId: true,
  stripeChargesEnabled: true,
  stripePayoutsEnabled: true,
  stripeDetailsSubmitted: true,
  stripeStatusAt: true,
} as const;

export async function getOnlinePaymentsStatus(companyId: string): Promise<OnlinePaymentsStatus> {
  const row = await prisma.company.findUnique({ where: { id: companyId }, select: STATUS_SELECT });
  return {
    configured: stripeConfig() !== null,
    accountId: row?.stripeAccountId ?? null,
    chargesEnabled: row?.stripeChargesEnabled ?? false,
    payoutsEnabled: row?.stripePayoutsEnabled ?? false,
    detailsSubmitted: row?.stripeDetailsSubmitted ?? false,
    statusAt: row?.stripeStatusAt?.toISOString() ?? null,
  };
}

export async function linkStripeAccount(companyId: string, accountId: string): Promise<void> {
  await prisma.company.update({
    where: { id: companyId },
    data: {
      stripeAccountId: accountId,
      stripeChargesEnabled: false,
      stripePayoutsEnabled: false,
      stripeDetailsSubmitted: false,
      stripeStatusAt: new Date(),
    },
  });
}

/** Store what Stripe reported for a company's account. */
export async function saveConnectStatus(companyId: string, status: ConnectStatus): Promise<void> {
  await prisma.company.update({
    where: { id: companyId },
    data: {
      stripeChargesEnabled: status.chargesEnabled,
      stripePayoutsEnabled: status.payoutsEnabled,
      stripeDetailsSubmitted: status.detailsSubmitted,
      stripeStatusAt: new Date(),
    },
  });
}

/** The webhook's account.updated: by account id. False when no practice has it. */
export async function saveConnectStatusByAccount(accountId: string, status: ConnectStatus): Promise<boolean> {
  const r = await prisma.company.updateMany({
    where: { stripeAccountId: accountId },
    data: {
      stripeChargesEnabled: status.chargesEnabled,
      stripePayoutsEnabled: status.payoutsEnabled,
      stripeDetailsSubmitted: status.detailsSubmitted,
      stripeStatusAt: new Date(),
    },
  });
  return r.count > 0;
}

const DISCONNECTED = {
  stripeAccountId: null,
  stripeChargesEnabled: false,
  stripePayoutsEnabled: false,
  stripeDetailsSubmitted: false,
};

/**
 * Forget the link. The practice's Stripe account itself is untouched (it is
 * theirs, with its own balance and history); AEC-flow simply stops offering
 * online payment. Existing /pay links then say online payment is unavailable.
 */
export async function unlinkStripeAccount(companyId: string): Promise<void> {
  await prisma.company.update({ where: { id: companyId }, data: { ...DISCONNECTED, stripeStatusAt: new Date() } });
}

export async function unlinkStripeAccountById(accountId: string): Promise<boolean> {
  const r = await prisma.company.updateMany({
    where: { stripeAccountId: accountId },
    data: { ...DISCONNECTED, stripeStatusAt: new Date() },
  });
  return r.count > 0;
}

/** The connected account, when it can take card payments; null otherwise. */
async function chargeableAccount(companyId: string): Promise<string | null> {
  const row = await prisma.company.findUnique({
    where: { id: companyId },
    select: { stripeAccountId: true, stripeChargesEnabled: true },
  });
  return row?.stripeAccountId && row.stripeChargesEnabled ? row.stripeAccountId : null;
}

/**
 * The invoice's Pay online link, creating its token the first time. Null when
 * online payment is off (no keys, practice not connected or not yet able to
 * charge) or the invoice owes nothing. For signed-in screens only.
 */
export async function payLinkFor(invoice: {
  id: string;
  status: string;
  outstanding: number;
  currency: string;
}): Promise<string | null> {
  if (!stripeConfig() || !isOnlinePayable(invoice) || !isCardCurrencySupported(invoice.currency)) return null;
  const companyId = await currentCompanyId();
  if (!companyId) return null;
  if (!(await chargeableAccount(companyId))) return null;

  const row = await prisma.invoice.findFirst({ where: { id: invoice.id, deletedAt: null }, select: { payToken: true } });
  if (!row) return null;
  let token = row.payToken;
  if (!token) {
    // Only where it is still empty, so two screens opening at once agree on one token.
    await prisma.invoice.updateMany({ where: { id: invoice.id, payToken: null }, data: { payToken: newPayToken() } });
    token = (await prisma.invoice.findFirst({ where: { id: invoice.id }, select: { payToken: true } }))?.payToken ?? null;
  }
  return token ? payUrl(publicBaseUrl(process.env), token) : null;
}

/**
 * /pay/<token> → the invoice and its company, or null. RAW on purpose (see the
 * file note): the visitor has no session and may be signed in to a different
 * practice. Callers check the token's shape first.
 */
export async function resolvePayToken(token: string): Promise<{ invoiceId: string; companyId: string } | null> {
  const rows = await prisma.$queryRaw<{ invoiceId: string; companyId: string | null }[]>`
    SELECT "id" AS "invoiceId", "companyId"
    FROM "invoices"
    WHERE "payToken" = ${token} AND "deletedAt" IS NULL
    LIMIT 1`;
  const r = rows[0];
  return r && r.companyId ? { invoiceId: r.invoiceId, companyId: r.companyId } : null;
}

/** The webhook's lookup: an invoice id from a signed event → its company and account. RAW, same reason. */
export async function findInvoiceForPayment(invoiceId: string): Promise<InvoiceForPayment | null> {
  const rows = await prisma.$queryRaw<
    { invoiceId: string; companyId: string | null; currency: string; stripeAccountId: string | null }[]
  >`
    SELECT i."id" AS "invoiceId", i."companyId", i."currency", c."stripeAccountId"
    FROM "invoices" i
    LEFT JOIN "companies" c ON c."id" = i."companyId"
    WHERE i."id" = ${invoiceId} AND i."deletedAt" IS NULL
    LIMIT 1`;
  const r = rows[0];
  if (!r || !r.companyId) return null;
  return { invoiceId: r.invoiceId, companyId: r.companyId, currency: r.currency, stripeAccountId: r.stripeAccountId };
}

/**
 * What the public pay page needs to know about the practice: the name it puts on
 * its letterhead (Settings → Practice, else the company's own name) and whether
 * it can take a card now.
 */
export async function practiceForPayment(
  companyId: string,
): Promise<{ name: string; stripeAccountId: string | null }> {
  const [company, config] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
    prisma.appConfig.findUnique({ where: { id: companyId }, select: { data: true } }),
  ]);
  const profile = (config?.data as { practiceProfile?: { name?: unknown } } | null)?.practiceProfile;
  const name =
    (typeof profile?.name === "string" && profile.name.trim()) || company?.name?.trim() || "AEC-flow";
  return { name, stripeAccountId: stripeConfig() ? await chargeableAccount(companyId) : null };
}
