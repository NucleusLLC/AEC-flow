"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Archive, ArchiveRestore, Loader2 } from "lucide-react";
import type { DevProjectStatus } from "@/lib/data/development.types";

const btn = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-50";

export function DevProjectActions({ projectId, status }: { projectId: string; status: DevProjectStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "dup" | "arch">(null);
  const [err, setErr] = useState<string | null>(null);
  const archived = status === "ARCHIVED";

  async function duplicate() {
    setBusy("dup"); setErr(null);
    try {
      const res = await fetch(`/api/development/${projectId}/duplicate`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? `Failed (${res.status})`); return; }
      router.push(`/development/${json.data.id}`);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  async function toggleArchive() {
    setBusy("arch"); setErr(null);
    try {
      const res = await fetch(`/api/development/${projectId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: archived ? "PLANNING" : "ARCHIVED" }),
      });
      const json = await res.json();
      if (!res.ok) { setErr(json.error ?? `Failed (${res.status})`); return; }
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button type="button" onClick={duplicate} disabled={busy != null} className={btn}>
          {busy === "dup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} Duplicate
        </button>
        <button type="button" onClick={toggleArchive} disabled={busy != null} className={btn}>
          {busy === "arch" ? <Loader2 className="h-4 w-4 animate-spin" /> : archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          {archived ? "Unarchive" : "Archive"}
        </button>
      </div>
      {err ? <span className="text-[11px] text-amber-700">{err}</span> : null}
    </div>
  );
}
