"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { LogOut, LogIn, Settings } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  DIRECTOR: "Director",
  MANAGER: "Manager",
  STAFF: "Staff",
  VIEWER: "Viewer",
};

function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);

  // When auth isn't enforced and nobody is signed in, offer a quiet sign-in link.
  if (status !== "authenticated") {
    return (
      <Link
        href="/login"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <LogIn className="h-4 w-4" />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }

  const user = session.user;
  const role = user.role ? ROLE_LABEL[user.role] ?? user.role : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-xs font-semibold text-brand ring-1 ring-inset ring-brand/20 transition-colors hover:bg-brand/15"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {initials(user.name)}
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
            <div className="border-b border-border px-4 py-3">
              <div className="truncate text-sm font-medium text-fg">{user.name}</div>
              <div className="truncate text-xs text-muted">{user.email}</div>
              {role ? <div className="mt-1 text-[11px] font-medium text-brand">{role}</div> : null}
            </div>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-fg transition-colors hover:bg-surface-2"
            >
              <Settings className="h-4 w-4 text-faint" />
              My account
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-sm text-fg transition-colors hover:bg-surface-2"
            >
              <LogOut className="h-4 w-4 text-faint" />
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
