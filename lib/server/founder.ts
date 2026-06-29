/**
 * Founder identity. The document footer is app-level advertising that only the
 * founder/creator may edit — every other user (beta testers, company staff)
 * sees it locked. The founder account is identified by email, overridable via
 * the FOUNDER_EMAIL env var so it isn't hard-wired.
 *
 * SERVER-ONLY (reads the session). Client components receive an `isFounder`
 * boolean as a prop from the server.
 */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const FOUNDER_EMAIL = (process.env.FOUNDER_EMAIL || "greg@zenarch.net").trim().toLowerCase();

export function isFounderEmail(email?: string | null): boolean {
  return !!email && email.trim().toLowerCase() === FOUNDER_EMAIL;
}

export async function isCurrentUserFounder(): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return isFounderEmail(session?.user?.email);
}
