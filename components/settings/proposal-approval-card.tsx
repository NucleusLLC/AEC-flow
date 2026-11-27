"use client";

/**
 * Settings → Proposal Templates → Proposal approval: the two limits above which a Service
 * Proposal needs a Director's approval before it is sent (owner's ruling 27 Nov 2026,
 * lib/proposals/approval.ts). Stored per company in the AppConfig blob — no table, no SQL.
 *
 * Read-only for anyone who is not an Admin, a Director or the founder; the action checks
 * the same gate again (app/(app)/settings/actions.ts).
 */

import { useState, useTransition } from "react";
import { Check, Lock, TriangleAlert } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useT } from "@/components/i18n/language-provider";
import { saveProposalApprovalAction } from "@/app/(app)/settings/actions";
import { MAX_FEE_LIMIT, type ApprovalThresholds } from "@/lib/proposals/approval";

const inputCls =
  "mt-1 h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:opacity-60";

export function ProposalApprovalCard({
  initial,
  canSave,
}: {
  initial: ApprovalThresholds;
  canSave: boolean;
}) {
  const t = useT();
  const [pct, setPct] = useState(String(initial.maxDiscountPercent));
  const [fee, setFee] = useState(String(initial.maxFee));
  const [currency, setCurrency] = useState(initial.currency);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const disabled = !canSave || pending;

  function save() {
    setMsg(null);
    start(async () => {
      const res = await saveProposalApprovalAction({ maxDiscountPercent: pct, maxFee: fee });
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      // Show what was stored: out-of-range numbers come back clamped.
      setPct(String(res.data.maxDiscountPercent));
      setFee(String(res.data.maxFee));
      setCurrency(res.data.currency);
      setMsg({ kind: "ok", text: "Approval limits saved." });
    });
  }

  return (
    <Card>
      <CardHeader
        title={t("Proposal approval")}
        subtitle={t("A proposal over either limit needs a Director's approval before it can be sent to the client.")}
      />
      <CardBody className="space-y-4">
        {!canSave ? (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>{t("Only an Admin or a Director can change the practice's settings.")}</span>
          </p>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-muted">{t("Maximum discount without approval (%)")}</span>
            <input
              type="number"
              data-testid="approval-max-discount"
              min={0}
              max={100}
              step={0.5}
              value={pct}
              disabled={disabled}
              onChange={(e) => setPct(e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted">
              {t("Maximum total fee without approval")} ({currency})
            </span>
            <input
              type="number"
              data-testid="approval-max-fee"
              min={0}
              max={MAX_FEE_LIMIT}
              step={1000}
              value={fee}
              disabled={disabled}
              onChange={(e) => setFee(e.target.value)}
              className={`${inputCls} font-mono`}
            />
          </label>
        </div>
        <p className="text-[11px] text-faint">
          {t("The fee limit is in the practice's system currency. Proposals in another currency are compared at the app's fixed rates; where there is none, only the discount rule applies.")}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            data-testid="approval-save"
            onClick={save}
            disabled={disabled}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{pending ? t("Saving…") : t("Save approval limits")}</span>
          </button>
          {msg ? (
            <span
              className={`inline-flex items-center gap-1.5 text-sm ${msg.kind === "ok" ? "text-emerald-700" : "text-red-600"}`}
            >
              {msg.kind === "ok" ? <Check className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}
              <span>{t(msg.text)}</span>
            </span>
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}
