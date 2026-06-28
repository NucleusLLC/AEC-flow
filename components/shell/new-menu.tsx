"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Users,
  FileText,
  ClipboardList,
  FolderKanban,
  FileSignature,
  UserPlus,
  CalendarDays,
  NotebookPen,
} from "lucide-react";

// Only create routes that actually exist are listed.
const ACTIONS = [
  { label: "New client", href: "/clients/new", icon: Users },
  { label: "New proposal", href: "/proposals/new", icon: FileText },
  { label: "New order", href: "/orders/new", icon: ClipboardList },
  { label: "New project", href: "/projects/new", icon: FolderKanban },
  { label: "New meeting minutes", href: "/meetings/new", icon: NotebookPen },
  { label: "New change order", href: "/construction-admin/change-orders/new", icon: FileSignature },
  { label: "Add team member", href: "/team/new", icon: UserPlus },
  { label: "Request leave", href: "/leave/new", icon: CalendarDays },
];

export function NewMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
      >
        <Plus className="h-4 w-4" />
        New
      </button>

      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg">
            {ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.href}
                  href={a.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-fg transition-colors hover:bg-surface-2"
                >
                  <Icon className="h-4 w-4 text-faint" />
                  {a.label}
                </Link>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
