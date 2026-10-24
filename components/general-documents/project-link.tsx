"use client";

/**
 * Filing a General Document under a project, from either side.
 *
 * `DocumentProjectLink` sits on the document page: pick a project (or none) and
 * file it. `LinkExistingDocument` sits on a project's Documents tab: pick one of
 * the practice's documents that is not filed under any project yet.
 *
 * Both work whatever the document's status — a signed power of attorney can be
 * filed under the job it belongs to without being superseded, because the
 * project link is filing, not content. The server action is the control; these
 * are only the buttons.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderInput, Link2 } from "lucide-react";
import { linkDocumentProjectAction } from "@/app/(app)/documents/general/actions";
import { useT } from "@/components/i18n/language-provider";

const SELECT =
  "h-9 min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-fg focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
const BTN =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-surface-2 disabled:opacity-60";

export type LinkOption = { id: string; name: string };

export function DocumentProjectLink({
  documentId,
  projectId,
  projectName,
  projects,
}: {
  documentId: string;
  projectId: string | null;
  projectName: string | null;
  projects: LinkOption[];
}) {
  const t = useT();
  const router = useRouter();
  const [value, setValue] = useState(projectId ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = value !== (projectId ?? "");

  async function save() {
    setError(null);
    setPending(true);
    const res = await linkDocumentProjectAction(documentId, value || null);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">
        {projectId ? (
          <>
            <span>{t("Filed under")} </span>
            <Link href={`/projects/${projectId}/documents`} className="font-medium text-brand hover:underline">
              {projectName ?? t("the project")}
            </Link>
          </>
        ) : (
          <span>{t("Not filed under a project yet. It will not show on any project's Documents tab.")}</span>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={SELECT}
          aria-label={t("Project")}
        >
          <option value="">{t("— none —")}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={save} disabled={!changed || pending} className={BTN}>
          <FolderInput className="h-4 w-4" />
          {pending
            ? t("Saving…")
            : !value && projectId
              ? t("Remove from project")
              : t("File under project")}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

export function LinkExistingDocument({
  projectId,
  documents,
}: {
  projectId: string;
  /** Documents not filed under any project. */
  documents: LinkOption[];
}) {
  const t = useT();
  const router = useRouter();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (documents.length === 0) {
    return <p className="text-sm text-muted">{t("Every document is already filed under a project.")}</p>;
  }

  async function link() {
    if (!value) return;
    setError(null);
    setPending(true);
    const res = await linkDocumentProjectAction(value, projectId);
    setPending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setValue("");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={SELECT}
          aria-label={t("Link an existing document")}
        >
          <option value="">{t("Pick a document not filed under a project…")}</option>
          {documents.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={link} disabled={!value || pending} className={BTN}>
          <Link2 className="h-4 w-4" />
          {pending ? t("Linking…") : t("Link to this project")}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
