"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus } from "lucide-react";
import { convertServiceProposalAction } from "@/app/(app)/design/service-proposals/actions";
import { CONVERT_BLOCKER_MESSAGE } from "@/lib/proposals/convert";
import { useT } from "@/components/i18n/language-provider";

/**
 * "Create project" on an accepted proposal (Release D).
 *
 * Opens a small panel rather than acting on one click: making a project is not
 * undone by clicking again, and the panel is where the project number can be
 * typed (blank = the next automatic one, as on the New project form). A proposal
 * already linked to a project gets "Mark converted" instead — no second project.
 */
export function ConvertToProject({
  id,
  hasProject,
  hasClient,
}: {
  id: string;
  hasProject: boolean;
  hasClient: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const blocked = !hasProject && !hasClient;

  function submit() {
    setError(null);
    start(async () => {
      const res = await convertServiceProposalAction(id, hasProject ? null : number.trim() || null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/projects/${res.projectId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending || blocked}
        title={blocked ? t(CONVERT_BLOCKER_MESSAGE.client) : undefined}
        onClick={() => (hasProject ? submit() : setOpen((v) => !v))}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
      >
        <FolderPlus className="h-4 w-4" aria-hidden="true" />
        <span>{hasProject ? t("Mark converted") : t("Create project")}</span>
      </button>
      {blocked ? <p className="text-xs text-muted">{t(CONVERT_BLOCKER_MESSAGE.client)}</p> : null}

      {open && !hasProject ? (
        <div className="max-w-md space-y-3 rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-fg">
            {t(
              "A new project is created for this client with the proposal’s phases, disciplines and fee (before tax). The proposal is then marked converted and locked.",
            )}
          </p>
          <label className="block space-y-1 text-sm">
            <span className="text-muted">{t("Project number")}</span>
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder={t("Leave blank for the next number")}
              maxLength={40}
              className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm text-fg"
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={submit}
              className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50"
            >
              {pending ? t("Creating…") : t("Create project")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setOpen(false)}
              className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm text-muted hover:text-fg"
            >
              {t("Cancel")}
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
