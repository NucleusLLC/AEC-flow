"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, FolderPlus } from "lucide-react";
import { saveProject } from "@/app/(app)/projects/actions";

export type CreatedProject = {
  /** Project row id — what estimates key off. */
  id: string;
  /** Project number — what schedules key off (`ProjectSchedule.projectId`). */
  projectNumber: string;
  projectName: string;
  client: string;
  location: string;
};

/**
 * Inline "Add new project" panel — mirrors the "+ New project" row on the
 * service-proposal form. Shared by the Schedule and Estimates pickers so work
 * can be started for a project that does not exist yet without leaving the page.
 *
 * Calls the same `saveProject` action `/projects/new` uses, so the project
 * number, the standard six-phase set, tenant scoping and activity logging all
 * stay in one place. `manager` is passed empty on purpose: resolveManagerId
 * falls back to the most senior user, and asking for one here would turn a
 * shortcut into a second form.
 */
export function NewProjectPanel({
  clients,
  onCreated,
  onCancel,
  submitLabel = "Create project",
}: {
  clients: { id: string; name: string }[];
  onCreated: (project: CreatedProject) => void;
  onCancel: () => void;
  /** Names what happens next, e.g. "Create project & schedule it". */
  submitLabel?: string;
}) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Project name is required.");
      return;
    }
    // createProject resolves the client by NAME and throws when it finds none,
    // so refuse here with something actionable rather than letting the server
    // come back with "Client not found".
    const client = clients.find((c) => c.id === clientId);
    if (!client) {
      setError("Choose a client — a project must belong to one.");
      return;
    }
    setError(null);

    start(async () => {
      const res = await saveProject("new", {
        name: trimmed,
        clientName: client.name,
        manager: "",
        siteAddress: address.trim() || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (!res.projectNumber) {
        setError("Project saved but no project number came back — reload the page.");
        return;
      }
      onCreated({
        id: res.id,
        projectNumber: res.projectNumber,
        projectName: trimmed,
        client: client.name,
        location: address.trim() || "—",
      });
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg">
        <FolderPlus className="h-4 w-4 text-brand" /> New project
      </p>
      <p className="mt-1 text-xs text-muted">
        Created with the standard six phases, then opened straight away.
      </p>

      {clients.length === 0 ? (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-500">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          No clients yet — add a client first, a project must belong to one.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block text-xs text-muted">
            Project name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Marina Heights Tower — Phase 3"
              aria-label="New project name"
              className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </label>
          <label className="block text-xs text-muted">
            Client
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              aria-label="Client for the new project"
              className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Site address <span className="text-faint">(optional)</span>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              aria-label="New project site address"
              className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
          </label>
        </div>
      )}

      {error ? (
        <p className="mt-3 flex items-start gap-1.5 text-xs text-red-500">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {error}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || clients.length === 0}
          className="inline-flex h-9 items-center rounded-lg bg-brand px-3 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90 disabled:opacity-50"
        >
          {pending ? "Creating…" : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="inline-flex h-9 items-center rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
