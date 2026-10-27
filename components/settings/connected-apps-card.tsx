"use client";

/**
 * Settings → Integrations → Connected apps. API tokens for desktop add-ins
 * (M.E.P.flow) to call /api/v1 — see docs/api/v1.md. A new token is shown ONCE,
 * here, with a copy button; afterwards only its first 12 characters are known.
 * Server side: app/(app)/settings/api-token-actions.ts (Admin / Director only).
 */
import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Plug, Trash2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDateLocale, useT } from "@/components/i18n/language-provider";
import { cn } from "@/lib/utils";
import type { ApiTokenListItem } from "@/lib/data/api-tokens";
import { createApiTokenAction, revokeApiTokenAction } from "@/app/(app)/settings/api-token-actions";
import { API_TOKEN_NAME_MAX } from "@/lib/api-tokens/limits";

const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60";

function day(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  // UTC so the server render and the browser agree.
  return new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function ConnectedAppsCard({
  initial,
  canManage,
}: {
  initial: ApiTokenListItem[];
  canManage: boolean;
}) {
  const t = useT();
  const locale = useDateLocale();
  const [tokens, setTokens] = useState(initial);
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const create = () =>
    start(async () => {
      setMsg(null);
      setCopied(false);
      const res = await createApiTokenAction(name);
      if (res.ok) {
        setFresh(res.data.token);
        setTokens(res.data.tokens);
        setName("");
      } else setMsg(res.error);
    });

  const revoke = (id: string) =>
    start(async () => {
      setMsg(null);
      const res = await revokeApiTokenAction(id);
      setConfirming(null);
      if (res.ok) setTokens(res.data);
      else setMsg(res.error);
    });

  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={t("Connected apps")}
        subtitle={t("Let desktop add-ins such as M.E.P.flow send their take-offs into this practice. Each app signs in with its own token.")}
      />
      <CardBody className="space-y-4">
        {!canManage ? (
          <p className="text-xs text-muted">{t("Only an Admin or a Director can change the practice's settings.")}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[240px] flex-1 flex-col gap-1 text-sm">
                <span className="font-medium text-fg">{t("Token name")}</span>
                <input
                  type="text"
                  value={name}
                  maxLength={API_TOKEN_NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim() && !busy) create();
                  }}
                  placeholder={t("e.g. M.E.P.flow on the drafting PC")}
                  className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-brand"
                />
              </label>
              <button
                type="button"
                onClick={create}
                disabled={busy || !name.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" /> {t("Create token")}
              </button>
            </div>

            {fresh ? (
              <div className="space-y-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-3" role="status">
                <p className="text-sm font-medium text-fg">{t("Copy this token now. It will not be shown again.")}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded bg-surface px-2 py-1.5 font-mono text-xs text-fg" data-testid="new-api-token">
                    {fresh}
                  </code>
                  <button type="button" onClick={copy} className={BTN}>
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                    {copied ? t("Copied") : t("Copy")}
                  </button>
                  <button type="button" onClick={() => setFresh(null)} className={BTN}>
                    {t("Done")}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        )}

        {tokens.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Plug className="h-4 w-4" /> {t("No tokens yet.")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-faint">
                  <th className="py-2 pr-3 font-medium">{t("Name")}</th>
                  <th className="py-2 pr-3 font-medium">{t("Token")}</th>
                  <th className="py-2 pr-3 font-medium">{t("Created")}</th>
                  <th className="py-2 pr-3 font-medium">{t("Last used")}</th>
                  <th className="py-2 pr-3 font-medium">{t("Status")}</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {tokens.map((tk) => (
                  <tr key={tk.id} className="zebra-row border-b border-border/60 align-middle">
                    <td className="py-2 pr-3 text-fg">{tk.name}</td>
                    <td className="py-2 pr-3">
                      <code className="font-mono text-xs text-muted">{tk.prefix}…</code>
                    </td>
                    <td className="py-2 pr-3 text-muted">{day(tk.createdAt, locale)}</td>
                    <td className="py-2 pr-3 text-muted">{day(tk.lastUsedAt, locale) ?? t("Never")}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={tk.revokedAt ? "slate" : "green"}>{tk.revokedAt ? t("Revoked") : t("Active")}</Badge>
                    </td>
                    <td className="py-2 text-right">
                      {canManage && !tk.revokedAt ? (
                        confirming === tk.id ? (
                          <span className="inline-flex flex-wrap items-center justify-end gap-2">
                            <span className="text-xs text-fg">{t("Revoke this token? Apps using it stop working at once.")}</span>
                            <button
                              type="button"
                              onClick={() => revoke(tk.id)}
                              disabled={busy}
                              className="inline-flex h-8 items-center rounded-lg bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-600/90 disabled:opacity-60"
                            >
                              {t("Revoke")}
                            </button>
                            <button type="button" onClick={() => setConfirming(null)} className={cn(BTN, "h-8 text-xs")}>
                              {t("Cancel")}
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirming(tk.id)}
                            disabled={busy}
                            className={cn(BTN, "h-8 text-xs text-red-600")}
                          >
                            <Trash2 className="h-3.5 w-3.5" /> {t("Revoke")}
                          </button>
                        )
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {msg ? <p className="text-sm text-red-600">{t(msg)}</p> : null}
      </CardBody>
    </Card>
  );
}
