"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Archive, ArchiveRestore, Loader2, Trash2, X } from "lucide-react";
import {
  archiveProjectAction,
  deleteProjectAction,
  restoreProjectAction,
} from "@/app/(app)/projects/lifecycle-actions";
import { confirmationMatches, PROJECT_LINK_LABEL, type ProjectLink } from "@/lib/projects/lifecycle";
import { militaryDate } from "@/lib/building-permits/register";
import { useT } from "@/components/i18n/language-provider";
import { fmt } from "@/lib/i18n/format";

/**
 * ARCHIVE / RESTORE / DELETE on the project header. See lib/projects/lifecycle.ts.
 *
 * A live project shows ARCHIVE only. Once archived, the button reads ARCHIVED
 * with the date and turns into RESTORE, and DELETE appears beside it — so a
 * project is always archived first and never deleted in one click.
 *
 * Military: capital labels, olive drab (the Take-Off ADD NEW hexes), dates `06 OCT 2026`.
 */
export function ProjectLifecycleButtons({
  projectId,
  projectNumber,
  projectName,
  archivedAt,
  canManage,
}: {
  projectId: string;
  projectNumber: string;
  projectName: string;
  /** ISO timestamp, or null while the project is live. */
  archivedAt: string | null;
  /** Admin, Director or founder. Others see the ARCHIVED stamp but no buttons. */
  canManage: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [archived, setArchived] = useState<string | null>(archivedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setArchived(archivedAt), [archivedAt]);

  const stamp = archived ? militaryDate(archived.slice(0, 10)) : null;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    const res = archived ? await restoreProjectAction(projectId) : await archiveProjectAction(projectId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setArchived(res.archivedAt ?? null);
    router.refresh();
  };

  const olive =
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#5c6633] px-3 text-sm font-semibold uppercase tracking-wide shadow-sm disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {archived && !canManage ? (
          <span className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#5c6633] bg-[#4b5320] px-3 font-mono text-xs font-semibold uppercase tracking-widest text-[#e4e8dc]">
            <Archive className="h-4 w-4" /> {t("ARCHIVED")} {stamp}
          </span>
        ) : null}

        {canManage ? (
          <button
            type="button"
            onClick={toggle}
            disabled={busy}
            title={archived ? t("Put this project back on the Projects list") : t("Hide this project from the Projects list. Nothing is deleted.")}
            className={
              archived
                ? `${olive} bg-[#4b5320] text-[#e4e8dc] hover:bg-[#3f4a1c]`
                : `${olive} bg-surface text-[#4b5320] hover:bg-[#4b5320] hover:text-[#e4e8dc] dark:text-[#c5d18a]`
            }
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : archived ? (
              <ArchiveRestore className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            {archived ? (
              <span>
                {t("ARCHIVED")} <span className="font-mono text-xs text-[#c5d18a]">{stamp}</span> · {t("RESTORE")}
              </span>
            ) : (
              t("ARCHIVE")
            )}
          </button>
        ) : null}

        {canManage && archived ? (
          <button
            type="button"
            onClick={() => setDeleting(true)}
            disabled={busy}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-rose-700 bg-rose-700 px-3 text-sm font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-rose-800 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> {t("DELETE")}
          </button>
        ) : null}
      </div>
      {error ? (
        <span role="alert" className="flex items-center gap-1 text-xs text-rose-600">
          <AlertTriangle className="h-3 w-3 shrink-0" /> {t(error)}
        </span>
      ) : null}

      {deleting ? (
        <DeleteProjectDialog
          projectId={projectId}
          projectNumber={projectNumber}
          projectName={projectName}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            router.push("/projects");
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function DeleteProjectDialog({
  projectId,
  projectNumber,
  projectName,
  onClose,
  onDeleted,
}: {
  projectId: string;
  projectNumber: string;
  projectName: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useT();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [links, setLinks] = useState<ProjectLink[]>([]);
  const matches = confirmationMatches(typed, projectNumber);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matches) return;
    setBusy(true);
    setFailure(null);
    const res = await deleteProjectAction(projectId, typed).catch(() => ({
      ok: false as const,
      error: "The project could not be deleted.",
      links: undefined,
    }));
    setBusy(false);
    if (res.ok) {
      onDeleted();
      return;
    }
    setFailure(res.error);
    setLinks(res.links ?? []);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <form
        role="alertdialog"
        aria-modal="true"
        aria-label={t("DELETE PROJECT")}
        onSubmit={submit}
        noValidate
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-rose-700 bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-rose-800 px-4 py-3 text-white">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
              <AlertTriangle className="h-4 w-4" /> {t("DELETE PROJECT")}
            </div>
            <div className="font-mono text-[11px] uppercase tracking-wider text-rose-100">
              {projectNumber} · {projectName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t("Close")}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-100 hover:text-white disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs text-rose-900">
            <div className="font-bold uppercase tracking-wide">{t("WARNING — THIS CANNOT BE UNDONE")}</div>
            <div className="mt-1">
              {t("The project, its phases and its activity log are removed for good. A project that invoices, time, drawings or any other record still point at cannot be deleted — it stays archived.")}
            </div>
          </div>

          {failure ? (
            <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <div className="font-semibold">{t("NOT DELETED.")} {t(failure)}</div>
              {links.length > 0 ? (
                <ul className="mt-1 list-disc pl-4">
                  {links.map((l) => (
                    <li key={l.key}>
                      {fmt(t("{label}: {count}"), { label: t(PROJECT_LINK_LABEL[l.key]), count: l.count })}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">
              {fmt(t("TYPE {number} TO CONFIRM"), { number: projectNumber })}
            </span>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={projectNumber}
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-sm uppercase text-fg outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-500/30"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted hover:text-fg disabled:opacity-40"
          >
            {t("Cancel")}
          </button>
          <button
            type="submit"
            disabled={busy || !matches}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-700 bg-rose-700 px-3 text-sm font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {busy ? t("Deleting…") : t("DELETE FOR GOOD")}
          </button>
        </div>
      </form>
    </div>
  );
}
