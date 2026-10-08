"use client";

/**
 * What every AEC-flow TV board shares (/officedash, /progressdash): the news relay,
 * the keep-fresh timers + wake lock, and the handover to the next board in the run.
 * Kept in one place so the boards cannot drift apart.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Same relay the Sigma board reads: world headlines + AI & innovation news, CORS-open. */
export const NEWS_URL = "https://cimgpycjczatjzltgscf.supabase.co/functions/v1/tv-news";
/** Fresh data every 2 minutes; a full reload every 30 as a backstop for a TV left on for weeks. */
const REFRESH_MS = 120_000;
const RELOAD_MS = 30 * 60_000;

export type NewsItem = { title: string; img: string; src: string; t: number; breaking: boolean };
const HOT_WORDS = /\b(breaking|killed|dead|deaths?|earthquake|tsunami|explosion|blast|attack|shooting|war|missile|strike[sd]?|crash|hurricane|evacuat\w*|emergency|coup|assassinat\w*)\b/i;
export const isHot = (x: NewsItem) => x.breaking || (HOT_WORDS.test(x.title) && (!Number.isFinite(x.t) || Date.now() - x.t < 12 * 3_600_000));

export function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60_000);
  if (!(m >= 0)) return "";
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : "";
}

/** World + AI headlines from the shared relay, every 10 minutes. A dead feed returns nothing and the bar hides. */
export function useNews() {
  const [news, setNews] = useState<{ world: NewsItem[]; ai: NewsItem[] }>({ world: [], ai: [] });
  useEffect(() => {
    const clean = (rows: unknown): NewsItem[] =>
      (Array.isArray(rows) ? rows : [])
        .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object" && (x as { title?: unknown }).title))
        .map((x) => ({ title: String(x.title), img: String(x.img ?? ""), src: String(x.src ?? ""), t: x.t ? +new Date(String(x.t)) : NaN, breaking: Boolean(x.breaking) }));
    const load = () =>
      fetch(NEWS_URL, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j && setNews({ world: clean(j.world), ai: clean(j.ai) }))
        .catch(() => undefined);
    void load();
    const id = window.setInterval(load, 10 * 60_000);
    return () => window.clearInterval(id);
  }, []);
  return news;
}

/** router.refresh every 2 min, a full reload every 30, and the screen kept awake. */
export function useKeepFresh() {
  const router = useRouter();
  useEffect(() => {
    const soft = window.setInterval(() => router.refresh(), REFRESH_MS);
    const hard = window.setTimeout(() => window.location.reload(), RELOAD_MS);
    // Keep the TV awake where the browser allows it; ignore a refusal.
    let lock: { release: () => Promise<void> } | null = null;
    const wake = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<typeof lock> } }).wakeLock?.request("screen") ?? null;
      } catch {
        lock = null;
      }
    };
    void wake();
    const onVisible = () => document.visibilityState === "visible" && void wake();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(soft);
      window.clearTimeout(hard);
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [router]);
}
