import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CreditCard } from "lucide-react";
import { getServerT } from "@/lib/i18n/server";
import { requireActor } from "@/lib/server/actor";
import { canManagePasswords } from "@/lib/password-policy";
import { billingConfig, intervalOfPrice } from "@/lib/billing/config";
import { BILLING_ENFORCED, canSubscribe, type BillingStatus } from "@/lib/billing/status";
import { countActiveMembers, getCompanyBilling } from "@/lib/data/billing";
import { militaryDate } from "@/lib/building-permits/register";
import { BillingButtons } from "@/components/billing/billing-buttons";

export async function generateMetadata() {
  const tr = await getServerT();
  return { title: `${tr("Billing")} · AEC-flow` };
}

const STATUS_LABEL: Record<BillingStatus, string> = {
  none: "No subscription",
  trialing: "Trial",
  active: "Active",
  past_due: "Payment past due",
  canceled: "Canceled",
};

const STATUS_TONE: Record<BillingStatus, string> = {
  none: "bg-muted/15 text-muted",
  trialing: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  past_due: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  canceled: "bg-red-500/10 text-red-700 dark:text-red-300",
};

/**
 * Settings › Billing — what this practice pays Nucleus LLC for AEC-flow
 * (decision D-5: Stripe Billing). Not there at all until the Stripe env vars
 * are set (404), and only for Admin / Director / founder.
 */
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const cfg = billingConfig();
  if (!cfg) notFound();
  const tr = await getServerT();
  const q = await searchParams;
  const actor = await requireActor();

  const back = (
    <Link href="/settings" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
      <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {tr("Settings")}
    </Link>
  );

  if (!canManagePasswords(actor.role, actor.isFounder)) {
    return (
      <div className="w-full max-w-3xl space-y-4">
        {back}
        <p className="rounded-xl border border-border bg-surface p-4 text-sm text-fg">
          {tr("Only an administrator or director can manage billing.")}
        </p>
      </div>
    );
  }

  const [company, members] = await Promise.all([getCompanyBilling(actor.companyId), countActiveMembers(actor.companyId)]);
  if (!company) notFound();

  const status = company.status;
  const interval = intervalOfPrice(cfg, company.priceId);
  const renewal = company.currentPeriodEnd ? militaryDate(company.currentPeriodEnd.toISOString()) : null;

  return (
    <div className="w-full max-w-3xl space-y-6">
      {back}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold text-fg">
          <CreditCard className="h-5 w-5 text-brand" aria-hidden="true" /> {tr("Billing")}
        </h2>
        <p className="text-sm text-muted">{tr("Your practice's AEC-flow subscription, paid to Nucleus LLC through Stripe.")}</p>
      </div>

      {q.checkout === "success" ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-fg">
          {tr("Thank you. Stripe is confirming your subscription; this page shows it within a minute.")}
        </p>
      ) : q.checkout === "cancel" ? (
        <p className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted">
          {tr("Checkout was cancelled. Nothing was charged.")}
        </p>
      ) : null}

      <div className="card-surface rounded-xl border border-border bg-surface p-5">
        {company.isFounder ? (
          <p className="text-sm text-fg">{tr("This is the founder practice. AEC-flow is free for it; there is nothing to pay.")}</p>
        ) : (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{tr("Status")}</dt>
              <dd className="mt-1">
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[status]}`}>
                  {tr(STATUS_LABEL[status])}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{tr("Plan")}</dt>
              <dd className="mt-1 text-sm text-fg">
                {status === "none"
                  ? tr("None yet")
                  : interval === "yearly"
                    ? tr("AEC-flow, yearly")
                    : interval === "monthly"
                      ? tr("AEC-flow, monthly")
                      : "AEC-flow"}
              </dd>
            </div>
            {renewal && status !== "none" ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {status === "canceled" || company.cancelAtPeriodEnd ? tr("Ends on") : tr("Renews on")}
                </dt>
                <dd className="mt-1 text-sm text-fg">{renewal}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{tr("Seats")}</dt>
              <dd className="mt-1 text-sm text-fg">
                {tr("{used} of {limit} in use").replace("{used}", String(members)).replace("{limit}", String(company.seatLimit))}
              </dd>
            </div>
          </dl>
        )}

        {!company.isFounder && company.cancelAtPeriodEnd && status !== "canceled" ? (
          <p className="mt-4 text-sm text-muted">{tr("The subscription is set to end at the close of this period.")}</p>
        ) : null}
        {!company.isFounder && status === "past_due" ? (
          <p className="mt-4 text-sm text-amber-800 dark:text-amber-300">
            {tr("The last payment did not go through. Update the card in Manage billing.")}
          </p>
        ) : null}
        {!BILLING_ENFORCED && !company.isFounder ? (
          <p className="mt-4 text-xs text-muted">{tr("Access is not limited by billing during the beta.")}</p>
        ) : null}

        {company.isFounder ? null : (
          <BillingButtons
            canSubscribe={canSubscribe(status)}
            hasYearly={!!cfg.yearlyPriceId}
            canManage={!!company.stripeCustomerId}
          />
        )}
      </div>
    </div>
  );
}
