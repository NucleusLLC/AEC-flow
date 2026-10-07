"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Barlow_Condensed, JetBrains_Mono, Saira_Stencil_One } from "next/font/google";
import { mil, pages, type Board, type DeadlineRow, type Lamp, type PermitRow, type PipelineStage } from "@/lib/officedash/board";
import type { DeadlineState } from "@/lib/building-permits/deadlines";
import s from "./office-board.module.css";

// Real fallbacks (not next/font's metric-adjusted Arial): if Google Fonts cannot be
// reached at build time the board still reads as stencil / condensed / monospace.
const stencil = Saira_Stencil_One({ weight: "400", subsets: ["latin"], variable: "--od-stencil", fallback: ["Impact", "sans-serif"], adjustFontFallback: false });
const body = Barlow_Condensed({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--od-body", fallback: ["Arial Narrow", "Arial", "sans-serif"], adjustFontFallback: false });
const mono = JetBrains_Mono({ weight: ["400", "600", "700"], subsets: ["latin"], variable: "--od-mono", fallback: ["Consolas", "Menlo", "monospace"], adjustFontFallback: false });

/** Rows per page — the board rotates when a list is longer. */
const PROJECT_ROWS = 9;
const PERMIT_ROWS = 7;
const CHASE_ROWS = 7;
/** DEADLINES shown on the strip of sheet OD-02; the rest are counted. */
const DEADLINE_CHIPS = 5;
/** Where the TV goes after its dwell (app/officedash/page.tsx sets the dwell). `www.` does not resolve for Sigma. */
const HANDOVER_URL = "https://sigma-cms.com/officedash";
/** Same relay the Sigma board reads: world headlines + AI & innovation news, CORS-open. */
const NEWS_URL = "https://cimgpycjczatjzltgscf.supabase.co/functions/v1/tv-news";
/** Fresh data every 2 minutes; a full reload every 30 as a backstop for a TV left on for weeks. */
const REFRESH_MS = 120_000;
const RELOAD_MS = 30 * 60_000;

const STAGES: PipelineStage[] = ["DRAFT", "TO SEND", "WITH CLIENT", "REVISE"];
const PERMIT_STATUS: Record<string, string> = {
  DRAFT: "DRAFT",
  PREPARING: "PREPARING",
  SUBMITTED: "SUBMITTED",
  IN_REVIEW: "IN REVIEW",
  INFO_REQUESTED: "INFO REQUESTED",
  CONCEPT_APPROVED: "CONCEPT OK",
  RESUBMITTED: "RESUBMITTED",
  WITHDRAWN: "WITHDRAWN",
  EXPIRED: "EXPIRED",
};

function useClock(timeZone: string) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // First paint after mount (the server's clock is UTC), then every second.
    const first = window.setTimeout(() => setNow(new Date()), 0);
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, []);
  if (!now) return { time: "----", date: "" };
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone, ...o }).format(now);
  const time = part({ hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", "");
  const date = `${part({ weekday: "short" })} ${part({ day: "2-digit" })} ${part({ month: "short" })} ${part({ year: "numeric" })}`.toUpperCase();
  return { time, date };
}

/** One tick per `seconds`; each list takes its page from it. */
function useTick(seconds: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), seconds * 1000);
    return () => window.clearInterval(id);
  }, [seconds]);
  return tick;
}


type NewsItem = { title: string; img: string; src: string; t: number; breaking: boolean };
const HOT_WORDS = /\b(breaking|killed|dead|deaths?|earthquake|tsunami|explosion|blast|attack|shooting|war|missile|strike[sd]?|crash|hurricane|evacuat\w*|emergency|coup|assassinat\w*)\b/i;
const isHot = (x: NewsItem) => x.breaking || (HOT_WORDS.test(x.title) && (!Number.isFinite(x.t) || Date.now() - x.t < 12 * 3_600_000));
function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60_000);
  if (!(m >= 0)) return "";
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : "";
}

/** World + AI headlines from the shared relay, every 10 minutes. A dead feed returns nothing and the bar hides. */
function useNews() {
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

function useKeepFresh() {
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

const lampClass: Record<Lamp, string> = { green: s.lampG, amber: s.lampA, red: s.lampR, off: s.lampO };

const dlClass: Record<DeadlineState, string> = { YELLOW: s.dlYellow, RED: s.dlRed, BLINK: s.dlBlink };

function dlWhen(days: number) {
  return days < 0 ? `${-days}D OVERDUE` : days === 0 ? "TODAY" : `IN ${days}D`;
}

function deadlineText(p: PermitRow) {
  if (!p.deadline) return { label: "—", cls: "", chip: "" };
  const d = p.deadline.days;
  // A DEADLINE set on the file shows in its own colour: yellow, red or blinking red.
  if (p.deadline.kind === "DEADLINE" && p.deadline.state) {
    return { label: `${p.deadline.label ?? "DEADLINE"} ${mil(p.deadline.date)} · ${dlWhen(d)}`, cls: "", chip: `${s.cellChip} ${dlClass[p.deadline.state]}` };
  }
  const when = d < 0 ? `${-d}D LATE` : d === 0 ? "TODAY" : `IN ${d}D`;
  return { label: `${p.deadline.kind} ${mil(p.deadline.date)} · ${when}`, cls: p.urgency === "late" ? s.red : p.urgency === "soon" ? s.amber : "", chip: "" };
}

type Screen = "projects" | "permits";

/**
 * The TV's run: PROJECTS for `dwell` s, then BUILDING PERMITS for `permitDwell` s,
 * then the Sigma board (which hands back after its own 20 s). `dwell` 0 stays put
 * on the screen named by `pin`, for checking one screen without the clock.
 */
function useRun(dwell: number, permitDwell: number, pin: Screen, next: string) {
  const [screen, setScreen] = useState<Screen>(dwell > 0 ? "projects" : pin);
  useEffect(() => {
    if (dwell <= 0) return;
    const toPermits = window.setTimeout(() => setScreen("permits"), dwell * 1000);
    const toSigma = window.setTimeout(() => window.location.assign(next), (dwell + permitDwell) * 1000);
    return () => {
      window.clearTimeout(toPermits);
      window.clearTimeout(toSigma);
    };
  }, [dwell, permitDwell, next]);
  return screen;
}

export function OfficeBoard({
  board,
  firmName,
  timeZone,
  dwell,
  permitDwell,
  pin,
  tvKey,
}: {
  board: Board;
  firmName: string;
  timeZone: string;
  dwell: number;
  permitDwell: number;
  pin: Screen;
  /** The TV key this board was opened with, passed on so the Sigma board can hand back without a login. */
  tvKey: string | null;
}) {
  const clock = useClock(timeZone);
  const screen = useRun(dwell, permitDwell, pin, tvKey ? `${HANDOVER_URL}?k=${encodeURIComponent(tvKey)}` : HANDOVER_URL);
  const projectPages = useMemo(() => pages(board.projects, PROJECT_ROWS), [board.projects]);
  const permitPages = useMemo(() => pages(board.permits, PERMIT_ROWS), [board.permits]);
  // Every page of a list gets shown inside its screen's time: 21 projects over 20 s is three pages of ~6 s.
  const ownTime = screen === "projects" ? dwell : permitDwell;
  const ownPages = screen === "projects" ? projectPages.length : permitPages.length;
  const tick = useTick(ownTime > 0 ? Math.max(4, Math.floor(ownTime / ownPages)) : 15);
  useKeepFresh();
  const news = useNews();
  const projectPage = tick % projectPages.length;
  const permitPage = tick % permitPages.length;
  const { counts } = board;

  return (
    <div className={`${s.screen} ${stencil.variable} ${body.variable} ${mono.variable}`}>
      <div className={s.stage}>
        <Axonometric />
        <div className={`${s.ui} ${news.world.length || news.ai.length ? "" : s.noNews}`}>
          <header className={`${s.glass} ${s.head}`}>
            <span className={s.title}>
              {screen === "projects" ? "SITREP" : "PERMITS"} · {firmName.toUpperCase()}
            </span>
            {screen === "projects" ? (
              <span className={s.kpis}>
                <span><b>{counts.engaged}</b>ENGAGED</span>
                <span><b className={counts.late ? s.red : ""}>{counts.late}</b>PAST TARGET</span>
                <span><b>{counts.onHold}</b>ON HOLD</span>
                <span><b>{counts.unsigned}</b>UNSIGNED</span>
              </span>
            ) : (
              <span className={s.kpis}>
                <span><b>{counts.permitsOpen}</b>OPEN FILES</span>
                <span><b className={board.permits.some((p) => p.urgency === "late") ? s.red : ""}>{board.permits.filter((p) => p.urgency === "late").length}</b>DEADLINE MISSED</span>
                <span><b>{board.permits.filter((p) => p.urgency === "soon").length}</b>DUE ≤ 7 D</span>
                <span><b className={counts.deadlinesRed ? s.red : ""}>{counts.deadlines}</b>DEADLINES</span>
              </span>
            )}
            <span className={s.clock}>
              <b>{clock.time} HRS</b>
              <span>{clock.date}</span>
            </span>
            <span className={s.titleBlock}>
              SHEET <b>{screen === "projects" ? "OD-01" : "OD-02"}</b> OF <b>02</b>
              <br />
              SCALE <b>NTS</b> · REV <b>{mil(board.today)}</b>
              <br />
              AEC-FLOW / OFFICEDASH
            </span>
          </header>

          {screen === "projects" ? (
            <div className={s.mid}>
              <section className={`${s.glass} ${s.panel}`}>
                <div className={s.panelHead}>
                  <h2>ENGAGED PROJECTS</h2>
                  {projectPages.length > 1 ? <span className={s.pager}>PAGE {projectPage + 1}/{projectPages.length}</span> : null}
                </div>
                <table className={`${s.table} ${s.big}`}>
                  <colgroup>
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "31%" }} />
                    <col style={{ width: "19%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "8%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>JOB</th>
                      <th>PROJECT</th>
                      <th>CLIENT</th>
                      <th>PHASE</th>
                      <th>PROGRESS</th>
                      <th className={s.right}>T-MINUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectPages[projectPage].map((p) => (
                      <tr key={p.id} className={p.late ? s.lateRow : ""}>
                        <td className={s.job}>
                          <span className={`${s.lamp} ${lampClass[p.lamp]}`} />
                          {p.number}
                        </td>
                        <td className={s.name}>{p.name.toUpperCase()}</td>
                        <td>{p.client}</td>
                        <td>{p.status === "ON_HOLD" ? "ON HOLD" : (p.phase ?? "No phase")}</td>
                        <td>
                          <div className={s.prog}>
                            <div className={s.bar}>
                              <i style={{ width: `${Math.max(p.progressPct, 1.5)}%` }} />
                            </div>
                            <span>{p.progressPct}%</span>
                          </div>
                        </td>
                        <td className={`${s.right} ${s.monoCell} ${p.late ? s.red : ""}`}>
                          {p.daysToTarget === null ? "—" : p.daysToTarget < 0 ? `${p.daysToTarget}D` : `+${p.daysToTarget}D`}
                        </td>
                      </tr>
                    ))}
                    {board.projects.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={s.empty}>NO ENGAGED PROJECTS</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </section>

              <aside className={`${s.glass} ${s.side}`}>
                <div className={s.panelHead}>
                  <h2>UNSIGNED PIPELINE</h2>
                  <span className={s.pager}>FOLLOW UP</span>
                </div>
                <div className={s.pipe}>
                  {STAGES.map((st) => (
                    <div key={st}>
                      <b>{board.pipeline[st]}</b>
                      <span>{st}</span>
                    </div>
                  ))}
                </div>
                <div className={`${s.chase} ${s.chaseBig}`}>
                  {board.chase.slice(0, CHASE_ROWS).map((c) => (
                    <div key={`${c.number}-${c.stage}`}>
                      <span className={s.ellip}>
                        {c.client}
                        <small>
                          {c.number} · {c.stage}
                          {c.copies > 1 ? ` · ${c.copies} COPIES` : ""}
                        </small>
                      </span>
                      <span className={`${s.age} ${c.waited > 14 ? s.red : ""}`}>{c.waited}D</span>
                    </div>
                  ))}
                  {board.chase.length === 0 ? <div className={s.empty}>NOTHING WAITING ON A SIGNATURE</div> : null}
                </div>
              </aside>
            </div>
          ) : (
            <PermitsScreen board={board} page={permitPages[permitPage]} pageNo={permitPage} pageCount={permitPages.length} />
          )}

          <StatsBar board={board} />
          <NewsBar world={news.world} ai={news.ai} />
        </div>
      </div>
    </div>
  );
}

/** Sheet OD-02: every open permit file — when it went in, how long it has been there, what is due next. */
function PermitsScreen({ board, page, pageNo, pageCount }: { board: Board; page: PermitRow[]; pageNo: number; pageCount: number }) {
  const atAuthority = board.permits.filter((p) => p.daysIn !== null);
  const avg = atAuthority.length ? Math.round(atAuthority.reduce((n, p) => n + (p.daysIn ?? 0), 0) / atAuthority.length) : null;
  const longest = atAuthority.reduce<PermitRow | null>((a, p) => ((p.daysIn ?? -1) > (a?.daysIn ?? -1) ? p : a), null);
  const late = board.permits.filter((p) => p.urgency === "late").length;
  const soon = board.permits.filter((p) => p.urgency === "soon").length;
  const tiles: { k: string; v: string; x?: string; cls?: string }[] = [
    { k: "OPEN FILES", v: String(board.permits.length) },
    { k: "WITH THE AUTHORITY", v: String(atAuthority.length), x: `${board.permits.length - atAuthority.length} not submitted` },
    { k: "AVERAGE DAYS IN", v: avg === null ? "—" : `${avg} D` },
    { k: "LONGEST", v: longest ? `${longest.daysIn} D` : "—", x: longest?.reference, cls: longest && (longest.daysIn ?? 0) >= 60 ? s.amber : "" },
    { k: "DUE ≤ 7 DAYS", v: String(soon), cls: soon ? s.amber : "" },
    { k: "DEADLINE MISSED", v: String(late), cls: late ? s.red : "" },
  ];
  return (
    <div className={`${s.permitScreen} ${board.deadlines.length ? s.permitScreenDl : ""}`}>
      <div className={s.tiles}>
        {tiles.map((t) => (
          <div key={t.k} className={`${s.glass} ${s.tile}`}>
            <span>{t.k}</span>
            <b className={t.cls}>{t.v}</b>
            {t.x ? <small>{t.x}</small> : null}
          </div>
        ))}
      </div>
      {board.deadlines.length ? <DeadlineStrip deadlines={board.deadlines} /> : null}
      <section className={`${s.glass} ${s.panel}`}>
        <div className={s.panelHead}>
          <h2>BUILDING PERMITS — OPEN FILES</h2>
          {pageCount > 1 ? <span className={s.pager}>PAGE {pageNo + 1}/{pageCount}</span> : <span className={s.pager}>RED = DEADLINE MISSED · AMBER = DUE ≤ 7 D</span>}
        </div>
        <table className={`${s.table} ${s.big}`}>
          <colgroup>
            <col style={{ width: "10%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "21%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>REF</th>
              <th>PROJECT / FILE</th>
              <th>AUTHORITY</th>
              <th>STATUS</th>
              <th>VER</th>
              <th>SUBMITTED</th>
              <th className={s.right}>DAYS IN</th>
              <th>NEXT DEADLINE</th>
            </tr>
          </thead>
          <tbody>
            {page.map((p) => {
              const dl = deadlineText(p);
              return (
                <tr key={p.id} className={p.urgency === "late" ? s.lateRow : ""}>
                  <td className={s.job}>{p.reference}</td>
                  <td className={s.name}>{(p.project ?? p.title).toUpperCase()}</td>
                  <td>{p.authority ?? "—"}</td>
                  <td>{PERMIT_STATUS[p.status] ?? p.status}</td>
                  <td className={s.monoCell}>{p.version ? `V${p.version}` : "—"}</td>
                  <td className={s.monoCell}>{p.submittedAt ? mil(p.submittedAt) : "NOT YET"}</td>
                  <td className={`${s.right} ${s.monoCell}`}>{p.daysIn ?? "—"}</td>
                  <td className={`${s.monoCell} ${dl.cls}`}>{dl.chip ? <span className={dl.chip}>{dl.label}</span> : dl.label}</td>
                </tr>
              );
            })}
            {board.permits.length === 0 ? (
              <tr>
                <td colSpan={8} className={s.empty}>NO OPEN PERMIT FILES</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/** The DEADLINES strip on OD-02: every open deadline set on a permit file, soonest first. */
function DeadlineStrip({ deadlines }: { deadlines: DeadlineRow[] }) {
  const shown = deadlines.slice(0, DEADLINE_CHIPS);
  const more = deadlines.length - shown.length;
  return (
    <section className={`${s.glass} ${s.dlStrip}`}>
      <div className={s.panelHead}>
        <h2>DEADLINES</h2>
        <span className={s.pager}>YELLOW &gt; 14 D · RED ≤ 14 D · BLINK ≤ 3 D / OVERDUE</span>
      </div>
      <div className={s.dlList}>
        {shown.map((d) => (
          <div key={d.id} className={`${s.dl} ${dlClass[d.state]}`} data-deadline-state={d.state}>
            <b>{dlWhen(d.days)}</b>
            <span>{d.label}</span>
            <small>
              {d.reference} · {mil(d.date)}
            </small>
          </div>
        ))}
        {more > 0 ? <span className={s.dlMore}>+{more} MORE</span> : null}
      </div>
    </section>
  );
}

/**
 * Gold-label scrolling row of firm numbers, as on the Sigma board, with the day's
 * orders riding along after the numbers. The track is doubled so the loop is seamless.
 */
function StatsBar({ board }: { board: Board }) {
  const { counts } = board;
  const active = board.projects.filter((p) => p.status === "ACTIVE");
  const avg = active.length ? Math.round(active.reduce((n, p) => n + p.progressPct, 0) / active.length) : 0;
  const longest = board.permits.reduce<PermitRow | null>((a, p) => ((p.daysIn ?? -1) > (a?.daysIn ?? -1) ? p : a), null);
  const items: { k: string; v: string; cls?: string; x?: string }[] = [
    { k: "Engaged projects", v: String(counts.engaged) },
    { k: "Past target", v: String(counts.late), cls: counts.late ? s.warnV : s.goodV },
    { k: "Average progress", v: `${avg}%` },
    { k: "Unsigned proposals", v: String(counts.unsigned), cls: s.goldV, x: `${board.pipeline["TO SEND"]} to send · ${board.pipeline["WITH CLIENT"]} with client` },
    { k: "Open permits", v: String(counts.permitsOpen) },
    ...(longest?.daysIn != null ? [{ k: "Longest with authority", v: `${longest.daysIn} D`, cls: longest.daysIn >= 60 ? s.warnV : undefined, x: longest.reference }] : []),
    { k: "Open tasks", v: String(counts.tasksOpen) },
    ...board.orders.slice(0, 8).map((o, i) => ({ k: `Order ${String(i + 1).padStart(2, "0")}`, v: o.text, cls: o.severity === "red" ? s.warnV : o.severity === "amber" ? s.goldV : undefined })),
  ];
  const one = items.map((it, i) => (
    <span key={i} className={s.statsRun}>
      <span className={s.statsIt}>
        <span className={s.statsK}>{it.k}</span>
        <span className={`${s.statsV} ${it.cls ?? ""}`}>{it.v}</span>
        {it.x ? <span className={s.statsX}>{it.x}</span> : null}
      </span>
      <span className={s.statsSep} />
    </span>
  ));
  return (
    <div className={s.stats}>
      <div className={s.statsLab}>AEC-FLOW STATS</div>
      <div className={s.statsWin}>
        <div className={s.statsTrack} style={{ animationDuration: `${Math.max(40, items.length * 7)}s` }}>
          {one}
          {one}
        </div>
      </div>
    </div>
  );
}

/**
 * Bottom news bar, as on the Sigma board: a red BREAKING panel (blue TOP STORY when
 * nothing is breaking) rotating one story every 10 s, and a slow AI & innovation ticker.
 */
function NewsBar({ world, ai }: { world: NewsItem[]; ai: NewsItem[] }) {
  const L = world.slice(0, 24);
  const A = ai.slice(0, 16);
  const hot = L.filter(isHot).slice(0, 6);
  const feat = hot.length ? hot : L.slice(0, 5);
  const tick = A.length ? A : L.filter((x) => !feat.includes(x));
  const [fi, setFi] = useState(0);
  useEffect(() => {
    if (feat.length < 2) return;
    const id = window.setInterval(() => setFi((n) => n + 1), 10_000);
    return () => window.clearInterval(id);
  }, [feat.length]);
  if (!L.length && !A.length) return null;
  const x = feat.length ? feat[fi % feat.length] : null;
  const run = tick.map((n, i) => (
    <span key={i} className={s.newsRun}>
      <span className={s.newsIt}>
        {n.img ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote news photos from many hosts, not worth an image loader
          <img src={n.img} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
        ) : null}
        <span className={s.newsTx}>
          <span className={s.newsTt}>{n.title}</span>
          <span className={s.newsTm}>
            <b>{n.src || "WORLD"}</b> · {ago(n.t)}
          </span>
        </span>
      </span>
      <span className={s.newsSep} />
    </span>
  ));
  return (
    <div className={s.news}>
      {x ? (
        <div className={`${s.newsFeat} ${hot.length ? "" : s.newsTop}`}>
          <div key={fi} className={s.newsSlide}>
            {x.img ? (
              // eslint-disable-next-line @next/next/no-img-element -- see above
              <img src={x.img} alt="" onError={(e) => (e.currentTarget.style.display = "none")} />
            ) : null}
            <div className={s.newsBx}>
              <span className={s.newsTag}>
                <i />
                {hot.length ? "BREAKING" : "TOP STORY"}
              </span>
              <div className={s.newsHl}>{x.title}</div>
              <div className={s.newsMt}>
                {x.src || "WORLD"}
                {ago(x.t) ? ` · ${ago(x.t)}` : ""}
              </div>
            </div>
          </div>
          <div className={s.newsDots}>
            {feat.map((_, i) => (
              <i key={i} className={i === fi % feat.length ? s.on : ""} />
            ))}
          </div>
        </div>
      ) : null}
      <div className={s.newsTick}>
        <div className={s.newsLab}>
          {A.length ? (
            <>
              <b>AI</b>
              <span>INNOVATION</span>
            </>
          ) : (
            <>
              <b>WORLD</b>
              <span>NEWS</span>
            </>
          )}
        </div>
        <div className={s.newsWin}>
          <div className={s.newsTrack} style={{ animationDuration: `${Math.max(60, tick.length * 14)}s` }}>
            {run}
            {run}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Faint axonometric massing study behind the glass. Static geometry, drawn once. */
function Axonometric() {
  const svg = useMemo(() => {
    const out: string[] = [];
    const c = "rgba(120,170,255,";
    const iso = (x: number, y: number, z: number) => [800 + (x - y) * 0.866, 520 + (x + y) * 0.5 - z];
    const line = (a: number[], b: number[], alpha: number, w = 1.1) =>
      out.push(`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${c}${alpha})" stroke-width="${w}"/>`);
    for (let i = -900; i <= 900; i += 60) {
      line(iso(i, -900, 0), iso(i, 900, 0), 0.05, 1);
      line(iso(-900, i, 0), iso(900, i, 0), 0.05, 1);
    }
    const box = (x: number, y: number, z: number, w: number, d: number, h: number, a: number) => {
      const P = [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z], [x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]].map((p) => iso(p[0], p[1], p[2]));
      [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]].forEach(([i, j]) => line(P[i], P[j], a));
      for (let f = 1; f * 32 < h; f++) {
        const q = [[x, y, z + f * 32], [x + w, y, z + f * 32], [x + w, y + d, z + f * 32]].map((p) => iso(p[0], p[1], p[2]));
        out.push(`<polyline points="${q.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ")}" fill="none" stroke="${c}${a * 0.5})" stroke-width=".7"/>`);
      }
    };
    box(-120, -140, 0, 220, 160, 420, 0.34);
    box(140, -60, 0, 260, 200, 200, 0.27);
    box(-360, 60, 0, 200, 240, 140, 0.22);
    box(200, 220, 0, 160, 140, 300, 0.2);
    box(-80, 300, 0, 300, 120, 90, 0.16);
    return out.join("");
  }, []);
  return <svg className={s.art} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />;
}
