"use client";

import { useState, useTransition } from "react";
import {
  Building2,
  FileText,
  Users,
  SlidersHorizontal,
  KeyRound,
  Sparkles,
  Check,
  X,
  Trash2,
  Type,
} from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { PracticeForm } from "@/components/settings/practice-form";
import { TemplatesManager } from "@/components/settings/templates-manager";
import { MembersManager } from "@/components/settings/members-manager";
import { DocumentControlForm } from "@/components/settings/document-control-form";
import {
  saveAnthropicApiKeyAction,
  clearAnthropicApiKeyAction,
  testAnthropicKeyAction,
} from "@/app/(app)/settings/actions";
import type { AnthropicKeyStatus } from "@/lib/server/ai-config";
import type { FooterSettings, LogoSettings } from "@/lib/server/practice-config";
import { cn } from "@/lib/utils";
import {
  type PracticeProfile,
  type ProposalTemplate,
  type Member,
  type RoleInfo,
  type Preferences,
} from "@/lib/data/settings";

type Tab = "practice" | "documentControl" | "templates" | "members" | "preferences" | "integrations";

const TABS: Array<{ key: Tab; label: string; icon: typeof Building2 }> = [
  { key: "practice", label: "Practice", icon: Building2 },
  { key: "documentControl", label: "Document Control", icon: Type },
  { key: "templates", label: "Proposal Templates", icon: FileText },
  { key: "members", label: "Members & Roles", icon: Users },
  { key: "preferences", label: "Preferences", icon: SlidersHorizontal },
  { key: "integrations", label: "Integrations", icon: KeyRound },
];

export function SettingsView({
  profile,
  logoDataUrl,
  currency,
  footer,
  logoSettings,
  documentFontId,
  templates,
  members,
  roles,
  preferences,
  keyStatus,
  canSave,
  isFounder = false,
}: {
  profile: PracticeProfile;
  logoDataUrl: string | null;
  currency: string;
  footer: FooterSettings;
  logoSettings: LogoSettings;
  documentFontId: string;
  templates: ProposalTemplate[];
  members: Member[];
  roles: RoleInfo[];
  preferences: Preferences;
  keyStatus: AnthropicKeyStatus;
  canSave: boolean;
  isFounder?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("practice");

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "border-brand text-fg" : "border-transparent text-muted hover:text-fg",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "practice" ? (
        <PracticeForm profile={profile} logoDataUrl={logoDataUrl} currency={currency} footer={footer} logoSettings={logoSettings} canSave={canSave} canEditFooter={isFounder} />
      ) : null}

      {tab === "documentControl" ? (
        <DocumentControlForm initialFontId={documentFontId} canSave={canSave} />
      ) : null}

      {tab === "templates" ? (
        <TemplatesManager templates={templates} canSave={canSave} />
      ) : null}

      {tab === "members" ? (
        <MembersManager members={members} roles={roles} canSave={canSave} />
      ) : null}

      {tab === "preferences" ? (
        <PreferencesForm preferences={preferences} canSave={canSave} />
      ) : null}

      {tab === "integrations" ? <IntegrationsTab initial={keyStatus} /> : null}
    </div>
  );
}

function IntegrationsTab({ initial }: { initial: AnthropicKeyStatus }) {
  const [status, setStatus] = useState<AnthropicKeyStatus>(initial);
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();

  const envManaged = status.source === "env";

  const save = () => {
    if (!key.trim() || saving) return;
    setMsg(null);
    startSave(async () => {
      const res = await saveAnthropicApiKeyAction(key);
      if (res.ok) {
        setStatus(res.status);
        setKey("");
        setMsg({ kind: "ok", text: "API key saved." });
      } else {
        setMsg({ kind: "err", text: res.error });
      }
    });
  };

  const clear = () => {
    if (saving) return;
    setMsg(null);
    startSave(async () => {
      const res = await clearAnthropicApiKeyAction();
      if (res.ok) {
        setStatus(res.status);
        setMsg({ kind: "ok", text: "API key removed." });
      } else {
        setMsg({ kind: "err", text: res.error });
      }
    });
  };

  const test = () => {
    if (testing) return;
    setMsg(null);
    startTest(async () => {
      const res = await testAnthropicKeyAction();
      setMsg({ kind: res.ok ? "ok" : "err", text: res.message });
    });
  };

  return (
    <Card>
      <CardHeader
        title="Anthropic API"
        subtitle="Powers AI features such as AI-Fetch in the Estimating Wiki."
      />
      <CardBody className="space-y-4">
        {/* Current status */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2/50 px-4 py-3">
          <Sparkles className="h-4 w-4 shrink-0 text-brand" />
          {status.configured ? (
            <span className="inline-flex items-center gap-2 text-sm text-fg">
              <Check className="h-4 w-4 text-emerald-600" />
              Key configured
              <code className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-muted">{status.masked}</code>
              <Badge tone={envManaged ? "blue" : "green"}>{envManaged ? "from environment" : "saved"}</Badge>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm text-muted">
              <X className="h-4 w-4 text-faint" />
              No API key configured — AI features are disabled.
            </span>
          )}
        </div>

        {envManaged ? (
          <p className="text-xs text-muted">
            A key is set via the <code className="font-mono">ANTHROPIC_API_KEY</code> environment variable, which takes
            precedence. Remove it from the environment to manage the key here instead.
          </p>
        ) : (
          <>
            <label className="block">
              <span className="text-xs font-medium text-muted">Anthropic API key</span>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                placeholder="sk-ant-…"
                autoComplete="off"
                className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-3 font-mono text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15"
              />
              <span className="mt-1 block text-[11px] text-faint">
                Stored server-side in a local config file (gitignored), never exposed to the browser. Get a key from
                console.anthropic.com → API Keys.
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving || !key.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save key"}
              </button>
              <button
                type="button"
                onClick={test}
                disabled={testing || !status.configured}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Sparkles className="h-4 w-4" /> {testing ? "Testing…" : "Test"}
              </button>
              {status.configured ? (
                <button
                  type="button"
                  onClick={clear}
                  disabled={saving}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </button>
              ) : null}
            </div>
          </>
        )}

        {/* env-managed keys can still be tested */}
        {envManaged ? (
          <button
            type="button"
            onClick={test}
            disabled={testing}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" /> {testing ? "Testing…" : "Test connection"}
          </button>
        ) : null}

        {msg ? (
          <p className={cn("text-sm", msg.kind === "ok" ? "text-emerald-700" : "text-red-600")}>{msg.text}</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
