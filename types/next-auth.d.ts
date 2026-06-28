import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

/** Carry the user's id + role through the JWT and session (see lib/auth.ts). */
declare module "next-auth" {
  interface User {
    role: UserRole;
  }
  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}
