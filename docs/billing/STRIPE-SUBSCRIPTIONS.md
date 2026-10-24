# AEC-flow subscription billing (Stripe)

**Decision D-5 — billing provider: DECIDED 10 OCT 2026 → Stripe Billing**, on the Nucleus LLC
Stripe account. Each practice (a `Company`) pays Nucleus LLC for AEC-flow.

This is **not** the client-invoice "Pay now" feature (Stripe Connect, `lib/payments/`), where a
practice's client pays the practice. The two use separate env vars and separate webhooks.

## What it does

| Piece | Where |
|---|---|
| Settings › Billing — plan, status, renewal / end date, seats; **Subscribe** (monthly, and yearly if configured) and **Manage billing** | `app/(app)/settings/billing/` (Admin / Director / founder only) |
| Stripe Checkout (subscription mode), `client_reference_id` = company id, one Stripe customer per practice, reused | `lib/billing/stripe.ts`, `app/(app)/settings/billing/actions.ts` |
| Stripe Customer Portal (change card, switch plan, cancel, invoices) | same |
| Webhook `POST /api/billing/webhook` — signature checked, idempotent by event id, out-of-order safe | `app/api/billing/webhook/route.ts`, `lib/billing/webhook.ts`, `lib/billing/signature.ts` |
| Banner across the app for **past due** / **canceled** (dismissable, never blocks) | `components/billing/billing-banner.tsx` |
| What each status would allow once enforced (`accessFor`) | `lib/billing/status.ts` |

**Nothing is enforced.** `BILLING_ENFORCED = false` in `lib/billing/status.ts`; no practice is ever
locked out by billing today. The founder practice (`companies.isFounder = true`) is always free and
never sees Subscribe or the banner. Beta practices start with no subscription (`none`) and see no
banner.

**Hidden until configured.** Without `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID_MONTHLY` the Billing
button does not appear, `/settings/billing` is a 404, the banner never shows, and the webhook
answers 404.

The Stripe status is stored on `companies` (`stripeCustomerId`, `stripeSubscriptionId`,
`subscriptionStatus`, `subscriptionPriceId`, `subscriptionCurrentPeriodEnd`,
`subscriptionCancelAtPeriodEnd`, `subscriptionEventAt`) and applied events in
`billing_webhook_events`. Status mapping: `trialing`, `active`; `past_due` + `unpaid` → past due;
`canceled` + `incomplete_expired` + `paused` → canceled; `incomplete` / anything else → none.

## Owner's setup — in this order

### 0. Database first

Apply `prisma/sql/0033_billing_subscriptions.sql` to production **before** the PR is merged
(Supabase SQL editor, or `node scripts/apply-sql.mjs prisma/sql/0033_billing_subscriptions.sql`),
then `node scripts/verify-data-api-lockdown.mjs`. It is additive and safe to run twice.

### 1. Product and prices (Stripe Dashboard → Product catalogue)

Do this in **test mode** first, then repeat in live mode.

1. **Add product** → name `AEC-flow`, description e.g. "AEC-flow practice management".
2. Add a **recurring** price, **monthly**, in the currency you bill in (USD suggested) → save.
   Copy its id (`price_…`) → this is `STRIPE_PRICE_ID_MONTHLY`.
3. Optional: add a second recurring price on the same product, **yearly** → `STRIPE_PRICE_ID_YEARLY`.
   Leave it out and the page offers monthly only.
4. A free trial, if wanted, is set on the price (or later in Checkout); the app shows "Trial" for it.

### 2. Customer Portal (Settings → Billing → Customer portal)

1. **Activate** the portal (test link and live link are separate).
2. Allow: update payment method, view invoice history, cancel subscription (at period end
   recommended), and — if there is a yearly price — switch plans between the two prices of the
   AEC-flow product.
3. Business information: the Nucleus LLC name, terms and privacy links
   (`https://aec-flow.com/terms`, `https://aec-flow.com/privacy`).
4. Default redirect link: `https://aec-flow.com/settings/billing`.

### 3. Webhook endpoint (Developers → Webhooks → Add endpoint)

- URL: `https://aec-flow.com/api/billing/webhook`
- Events to send — exactly these five:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- After saving, **Reveal** the signing secret (`whsec_…`) → `STRIPE_BILLING_WEBHOOK_SECRET`.

The app pins the Stripe API version it calls with (`2025-09-30.clover`, `lib/billing/stripe.ts`)
and reads both the older and the newer subscription / invoice shapes, so the endpoint's own API
version does not matter.

### 4. Vercel environment variables (project `aec-flow` → Settings → Environment Variables)

| Name | Value | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` (Production), `sk_test_…` (Preview) | mark **Sensitive** |
| `STRIPE_PRICE_ID_MONTHLY` | `price_…` | required — without it billing stays hidden |
| `STRIPE_PRICE_ID_YEARLY` | `price_…` | optional |
| `STRIPE_BILLING_WEBHOOK_SECRET` | `whsec_…` | **Sensitive**; one per endpoint (test and live differ) |

Env vars only take effect on the **next deploy** — redeploy (or merge) after adding them.
A restricted key works too if it has write access to Customers, Checkout Sessions and Customer
Portal sessions, and read access to Subscriptions.

### 5. Test it (test mode)

1. Sign in as a Director of a non-founder practice → Settings → **Billing** → **Subscribe**.
2. Pay with card `4242 4242 4242 4242`, any future date, any CVC.
3. Back on Settings › Billing the status reads **Active** with the renewal date within a minute
   (the webhook writes it). Stripe Dashboard → Webhooks → the endpoint shows 200s.
4. **Manage billing** → cancel → the page shows "Ends on …"; after the period (or "cancel
   immediately" in the Dashboard) it reads **Canceled** and the banner appears.
5. Card `4000 0000 0000 0341` (attaches, then fails) on renewal → **Payment past due** + banner.

## Switching enforcement on later

1. Decide the policy (today `accessFor`: trialing / active = full, past due = warn, canceled and
   never-subscribed = locked; founder always full). Beta practices are `none` and **would be
   locked** — give them a trial or a status first.
2. Set `BILLING_ENFORCED = true` and add the redirect in `app/(app)/layout.tsx` next to the
   licence check (`effectiveAccess(...) === "locked"` → `/settings/billing` for admins, a notice
   for everyone else). Keep `/settings/billing` and sign-out reachable.
3. Update the Terms ("The beta is free…", section on fees) **before** charging anyone; a Terms
   version change re-prompts every account.
