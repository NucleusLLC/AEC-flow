# Pay online — Stripe Connect setup

Clients pay a practice's AEC-flow invoice by card. The money goes to **the
practice's own Stripe account**, never to Nucleus: Nucleus LLC's Stripe account
is the Connect **platform**, each practice connects a **Standard** account, and
every checkout is a **direct charge** on that account. AEC-flow takes no fee
(`PLATFORM_FEE_BASIS_POINTS = 0` in `lib/payments/stripe.ts`).

How it works and what it refuses to do: `docs/finance/SPEC.md` §6a.

The feature is **off** until both keys below are set. With either missing there
is no Settings button, no link on invoices, `/pay/*` checkout answers 404-style
"not available", and the webhook route answers 404.

## Owner setup (once, in Nucleus LLC's Stripe account)

1. **Apply the SQL first.** `node scripts/apply-sql.mjs prisma/sql/0034_stripe_pay_now.sql`
   then `node scripts/verify-data-api-lockdown.mjs`. Before the PR is merged.
2. **Enable Connect.** Stripe dashboard → Connect → Get started. Choose to
   onboard accounts that use the **full Stripe Dashboard** (Standard), with
   **Stripe-hosted onboarding**. Fill in the platform profile (name "AEC-flow",
   website https://aec-flow.com, support email). Check that the Connect
   branding (Settings → Connect → Branding) shows AEC-flow, since practices
   see it during onboarding.
3. **Add the webhook endpoint.** Developers → Webhooks → Add destination:
   - Events from: **Connected accounts** (not "Your account").
   - Payload style: **Snapshot** (full event object). Not "thin" events.
   - API version: **2026-09-30.endive** (the version pinned in
     `lib/payments/stripe.ts`).
   - Endpoint URL: `https://aec-flow.com/api/stripe/webhook`
   - Events: `checkout.session.completed`,
     `checkout.session.async_payment_succeeded`, `account.updated`,
     `account.application.deauthorized`.
   - Copy its **Signing secret** (`whsec_...`).
4. **Add the keys in Vercel** (Project → Settings → Environment Variables,
   Production; Preview too if wanted, with TEST keys):
   - `STRIPE_SECRET_KEY` = the platform's secret key (`sk_live_...`; a
     restricted key also works if it may write Accounts, Account Links and
     Checkout Sessions and read Accounts).
   - `STRIPE_WEBHOOK_SECRET` = the signing secret from step 3.
   Then redeploy. `NEXTAUTH_URL` (already set) decides the address used in
   links; it must be `https://aec-flow.com`.
5. **Try it in test mode first.** Same steps with test keys on a Preview
   deployment: connect a practice (Stripe's test onboarding accepts test data),
   issue an invoice, open its Pay online link, pay with `4242 4242 4242 4242`,
   and check the payment appears on the invoice as "Card (Stripe)".

No `STRIPE_CONNECT_CLIENT_ID` is needed: onboarding uses Account Links, not OAuth.

## What a practice does

Settings → Integrations → Online payments → **Connect Stripe** (Admin or
Director). Stripe's hosted onboarding opens; they create or sign in to their own
Stripe account and give Stripe their business and bank details. Back in
AEC-flow the card shows Charges / Payouts on or off. Once charges are on, every
issued invoice with money owing shows a Pay online link (copy it into an email
or WhatsApp) and prints it.

**Disconnect** removes only AEC-flow's link; the Stripe account, its balance and
its history stay the practice's. Refunds and disputes are handled in their own
Stripe dashboard.

## Currency

The checkout charges the invoice's own currency. AWG is supported by Stripe
(two decimals), as are USD and EUR. Zero-decimal (JPY, KRW, ...) and
three-decimal (KWD, BHD, ...) currencies are refused. Whether a given card
network or payment method accepts AWG for a particular practice's account is
Stripe's decision per account; the practice's payment-method settings in their
Stripe dashboard decide what the client is offered.

## Files

- `lib/payments/stripe.ts` — REST client (no SDK), API version, fee constant
- `lib/payments/stripe-signature.ts` — `Stripe-Signature` HMAC-SHA256 + tolerance
- `lib/payments/pay-link.ts` — token, payable rule, amount via money.ts
- `lib/payments/webhook.ts` — event → payment / status decisions
- `lib/data/pay-now.ts` — Company Stripe columns, pay token, tenant-less lookups
- `app/api/stripe/webhook/route.ts` — the webhook
- `app/api/stripe/connect/{return,refresh}/route.ts` — onboarding return/refresh
- `app/pay/[token]/` — the public page, `checkout` route, `success` page
- `app/(app)/settings/stripe-actions.ts`, `components/settings/online-payments-card.tsx`
