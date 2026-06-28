"use client";

import { SessionProvider } from "next-auth/react";

/** Client wrapper so `useSession` works anywhere in the tree. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
