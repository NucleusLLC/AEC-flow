-- 0019 — confirm the address somebody signed up with.
--
-- Two parts, both additive:
--   1. User."emailVerifiedAt" — null means "never confirmed".
--   2. email_verification_tokens — same shape as the reset tokens from 0013, and a
--      SEPARATE table on purpose: one store for both kinds is one bug away from a
--      verification link resetting a password.
--
-- EVERY EXISTING ACCOUNT IS BACKFILLED as verified, to its own creation time.
-- These people have been using the app for months; asking them to re-prove an
-- address they already receive our mail at would be a lockout dressed as security.
-- Only accounts created after this runs start unverified.
--
-- RLS: the 0012 lockdown is per table, so the new table needs its own enable —
-- otherwise it is the one table in the schema the public roles could reach.
-- Run scripts/verify-data-api-lockdown.mjs afterwards; it checks exactly that.

alter table "User" add column if not exists "emailVerifiedAt" timestamp(3);

update "User" set "emailVerifiedAt" = coalesce("createdAt", now())
where "emailVerifiedAt" is null;

create table if not exists "email_verification_tokens" (
  "id"          text primary key,
  "userId"      text not null references "User"("id") on delete cascade,
  "tokenHash"   text not null unique,
  "expiresAt"   timestamp(3) not null,
  "usedAt"      timestamp(3),
  "requestedIp" text,
  "usedIp"      text,
  "emailStatus" text,
  "emailError"  text,
  "createdAt"   timestamp(3) not null default now()
);

create index if not exists "email_verification_tokens_userId_idx" on "email_verification_tokens" ("userId");
create index if not exists "email_verification_tokens_expiresAt_idx" on "email_verification_tokens" ("expiresAt");

alter table "email_verification_tokens" enable row level security;
revoke all on table "email_verification_tokens" from anon, authenticated;
