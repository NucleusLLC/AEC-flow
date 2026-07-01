import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/** Carry the user's id + role through the JWT and session (see lib/auth.ts). */
declare module "next-auth" {
  interface User {
    role: UserRole;
    companyId?: string | null;
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
  }
}
