import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/** Carry the user's id + role through the JWT and session (see lib/auth.ts). */
declare module "next-auth" {
  interface User {
    role: UserRole;
    companyId?: string | null;
    sessionVersion?: number;
  }
  interface Session {
    user: {
      id: string;
      role: UserRole;
      companyId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    companyId: string | null;
    /** User.sessionVersion when this token was issued (absent on older tokens = 0). */
    sv?: number;
    /** Epoch seconds of the last check of `sv` against the database. */
    svCheckedAt?: number;
  }
}
