"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteMaterialAction } from "@/app/(app)/materials/actions";

export function MaterialDeleteButton({ id, tag }: { id: string; tag: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  function remove() {
    start(async () => {
      await deleteMaterialAction(id);
      router.push("/materials");
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2 text-sm">
        <span className="text-muted">Delete {tag}?</span>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="inline-flex h-8 items-center rounded-lg bg-rose-600 px-3 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium text-muted hover:text-fg"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-muted transition-colors hover:border-rose-300 hover:text-rose-600"
    >
      <Trash2 className="h-4 w-4" /> Delete
    </button>
  );
}
