"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import type { PurchaseOrderLine } from "@/lib/procurement/types";
import { receivePurchaseOrderAction } from "@/app/(app)/procurement/actions";

export function PoReceivePanel({
  poId,
  lines,
}: {
  poId: string;
  lines: PurchaseOrderLine[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [received, setReceived] = useState<number[]>(
    lines.map((l) => Math.max(0, Math.min(Number(l.receivedQty) || 0, Number(l.quantity) || 0))),
  );

  function setQty(i: number, raw: number) {
    const max = Number(lines[i].quantity) || 0;
    const val = Math.max(0, Math.min(Number(raw) || 0, max));
    setReceived((prev) => prev.map((v, idx) => (idx === i ? val : v)));
  }

  function receiveAll() {
    setReceived(lines.map((l) => Number(l.quantity) || 0));
  }

  function submit() {
    setError(null);
    start(async () => {
      const res = await receivePurchaseOrderAction(poId, received);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  const allReceived = lines.every((l, i) => received[i] >= (Number(l.quantity) || 0) && (Number(l.quantity) || 0) > 0);

  return (
    <Card>
      <CardHeader
        title="Receive items"
        subtitle="Record delivered quantities — status updates automatically"
        action={
          <button
            type="button"
            onClick={receiveAll}
            className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:text-fg"
          >
            Receive all
          </button>
        }
      />
      <CardBody className="space-y-3">
        <div className="space-y-2">
          {lines.map((l, i) => {
            const ordered = Number(l.quantity) || 0;
            const done = received[i] >= ordered && ordered > 0;
            return (
              <div key={i} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-fg">{l.description || "—"}</div>
                  <div className="text-xs text-muted">
                    Ordered {ordered}
                    {l.unit ? ` ${l.unit}` : ""}
                  </div>
                </div>
                {done ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : (
                  <span className="w-4" />
                )}
                <input
                  type="number"
                  step="any"
                  min={0}
                  max={ordered}
                  value={received[i]}
                  onChange={(e) => setQty(i, Number(e.target.value))}
                  className="h-9 w-24 rounded-lg border border-border bg-surface px-3 text-right text-sm tabular-nums text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
                />
              </div>
            );
          })}
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">
            {allReceived ? "All items received → marks the PO Received." : "Partial receipts mark the PO Partially received."}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-brand-fg hover:bg-brand/90 disabled:opacity-50"
          >
            <PackageCheck className="h-4 w-4" />
            {pending ? "Saving…" : "Record receipt"}
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
