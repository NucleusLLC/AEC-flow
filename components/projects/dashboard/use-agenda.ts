"use client";

import { useCallback, useEffect, useState } from "react";
import {
  assignAgendaItemAction,
  createAgendaItemAction,
  deleteAgendaItemAction,
  importLocalAgendaAction,
  listProjectAgendaAction,
  setAgendaItemDoneAction,
  type AgendaResult,
} from "@/app/(app)/projects/agenda-actions";
import type { AgendaItem, AgendaKind } from "@/lib/data/agenda";

/**
 * One shared agenda per project for every widget on the page.
 *
 * The Tasks, Reminders and Agenda widgets are three views of the same rows, so
 * they share a single fetch and a single subscriber list — the same pattern the
 * localStorage `useSharedState` used, except the source of truth is now the
 * server. Each mutation returns the re-read list, so no widget ever renders a
 * locally patched guess.
 */
type LegacyEntry = { kind: AgendaKind; title: string; due: string | null; done: boolean };
/** `legacy` lives in the shared store too, so importing from one widget makes
 *  the prompt disappear from all of them rather than only the one clicked. */
type Store = { items: AgendaItem[]; loaded: boolean; error: string | null; legacy: LegacyEntry[] };

const stores = new Map<string, Store>();
const subscribers = new Map<string, Set<() => void>>();
/** In-flight first load, so N widgets mounting together cause one request. */
const loading = new Map<string, Promise<void>>();

function storeFor(projectId: string): Store {
  let s = stores.get(projectId);
  if (!s) {
    s = { items: [], loaded: false, error: null, legacy: [] };
    stores.set(projectId, s);
  }
  return s;
}

function publish(projectId: string, next: Store) {
  stores.set(projectId, next);
  subscribers.get(projectId)?.forEach((fn) => fn());
}

function applyResult(projectId: string, res: AgendaResult): string | null {
  if (res.ok) {
    publish(projectId, { ...storeFor(projectId), items: res.items, loaded: true, error: null });
    return null;
  }
  publish(projectId, { ...storeFor(projectId), loaded: true, error: res.error });
  return res.error;
}

const LEGACY_TASKS = (projectId: string) => `aec.proj.${projectId}.tasks`;
const LEGACY_REMINDERS = (projectId: string) => `aec.proj.${projectId}.reminders`;

type LegacyTask = { text?: string; done?: boolean; due?: string | null };
type LegacyReminder = { text?: string; at?: string; done?: boolean };

/** What is still sitting in this browser from the localStorage-only version. */
export function readLegacyAgenda(projectId: string): LegacyEntry[] {
  if (typeof window === "undefined") return [];
  const out: LegacyEntry[] = [];
  try {
    const tasks = JSON.parse(window.localStorage.getItem(LEGACY_TASKS(projectId)) ?? "[]") as LegacyTask[];
    for (const t of tasks) if (t?.text) out.push({ kind: "TASK", title: t.text, due: t.due ?? null, done: !!t.done });
  } catch {
    /* malformed storage — treat as empty */
  }
  try {
    const rem = JSON.parse(window.localStorage.getItem(LEGACY_REMINDERS(projectId)) ?? "[]") as LegacyReminder[];
    for (const r of rem) if (r?.text && r?.at) out.push({ kind: "REMINDER", title: r.text, due: r.at, done: !!r.done });
  } catch {
    /* malformed storage — treat as empty */
  }
  return out;
}

function clearLegacyAgenda(projectId: string) {
  try {
    window.localStorage.removeItem(LEGACY_TASKS(projectId));
    window.localStorage.removeItem(LEGACY_REMINDERS(projectId));
  } catch {
    /* nothing to clear */
  }
}

export function useAgenda(projectId: string) {
  const [, force] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    let set = subscribers.get(projectId);
    if (!set) {
      set = new Set();
      subscribers.set(projectId, set);
    }
    set.add(rerender);

    if (!storeFor(projectId).loaded && !loading.has(projectId)) {
      const p = listProjectAgendaAction(projectId)
        .then((res) => {
          applyResult(projectId, res);
        })
        .finally(() => loading.delete(projectId));
      loading.set(projectId, p);
    }
    // Read the browser-only leftovers once per project, into the shared store.
    const current = storeFor(projectId);
    if (current.legacy.length === 0) {
      const found = readLegacyAgenda(projectId);
      if (found.length > 0) publish(projectId, { ...storeFor(projectId), legacy: found });
    }

    return () => {
      set!.delete(rerender);
    };
  }, [projectId]);

  const run = useCallback(
    async (fn: () => Promise<AgendaResult>) => {
      setBusy(true);
      try {
        return applyResult(projectId, await fn());
      } finally {
        setBusy(false);
      }
    },
    [projectId],
  );

  const store = storeFor(projectId);

  return {
    items: store.items,
    loaded: store.loaded,
    error: store.error,
    busy,
    /** Items still in this browser only — drives the one-time import prompt. */
    legacy: store.legacy,
    create: (input: { kind: AgendaKind; title: string; due?: string | null; assigneeId?: string | null }) =>
      run(() => createAgendaItemAction({ projectId, ...input })),
    toggle: (id: string, done: boolean) => run(() => setAgendaItemDoneAction(projectId, id, done)),
    assign: (id: string, assigneeId: string | null) => run(() => assignAgendaItemAction(projectId, id, assigneeId)),
    remove: (id: string) => run(() => deleteAgendaItemAction(projectId, id)),
    dismissLegacy: () => {
      clearLegacyAgenda(projectId);
      publish(projectId, { ...storeFor(projectId), legacy: [] });
    },
    importLegacy: async () => {
      setBusy(true);
      try {
        const res = await importLocalAgendaAction(projectId, storeFor(projectId).legacy);
        if (!res.ok) {
          publish(projectId, { ...storeFor(projectId), loaded: true, error: res.error });
          return res.error;
        }
        clearLegacyAgenda(projectId);
        publish(projectId, { items: res.items, loaded: true, error: null, legacy: [] });
        return null;
      } finally {
        setBusy(false);
      }
    },
  };
}
