-- 0018 — sign out other sessions after a password change or reset.
--
-- Logins are JWTs; they cannot be deleted. Each user gets a version number that
-- every password change bumps, and lib/auth.ts refuses a token carrying an older
-- one. Every existing row starts at 0 and tokens issued before this ship count as
-- 0, so applying this signs nobody out.
--
-- Apply BEFORE merging the PR that adds `User.sessionVersion`: Prisma selects the
-- column on sign-in, so the code without it breaks every login.

alter table "User" add column if not exists "sessionVersion" integer not null default 0;
