"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Barlow_Condensed,
  JetBrains_Mono,
  Saira_Stencil_One,
} from "next/font/google";
import type {
  ChipKind,
  MissingTag,
  ProgressData,
  Tone,
} from "@/lib/progressdash/data";
import {
  buildAxis,
  chipStyle,
  dayLabel,
  dayMark,
  lastDataDay,
  longDate,
  overallPct,
  pctTone,
  spanBox,
} from "@/lib/progressdash/timeline";
import {
  ago,
  isHot,
  useKeepFresh,
  useNews,
  type NewsItem,
} from "@/components/officedash/tv-hooks";
import s from "./progress-board.module.css";

// Real fallbacks (not next/font's metric-adjusted Arial), as on /officedash.
const stencil = Saira_Stencil_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--pd-stencil",
  fallback: ["Impact", "sans-serif"],
  adjustFontFallback: false,
});
const body = Barlow_Condensed({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--pd-body",
  fallback: ["Arial Narrow", "Arial", "sans-serif"],
  adjustFontFallback: false,
});
const mono = JetBrains_Mono({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--pd-mono",
  fallback: ["Consolas", "Menlo", "monospace"],
  adjustFontFallback: false,
});

const toneClass: Record<Tone, string> = {
  cyan: "",
  green: s.gr,
  amber: s.am,
  red: s.rd,
};
const chipClass: Record<ReturnType<typeof chipStyle>, string> = {
  you: s.nxYou,
  go: s.nxGo,
  plain: "",
};
const phaseTone = { ok: "", amber: s.am, red: s.rd } as const;
const greyTags: ReadonlySet<MissingTag> = new Set([
  "DECISION",
  "SETUP",
  "VENDOR",
]);

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
  if (!now) return { time: "--:--", date: "" };
  const part = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone, ...o }).format(now);
  const time = part({ hour: "2-digit", minute: "2-digit", hour12: false });
  const zone =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value ?? "";
  const place = (timeZone.split("/").pop() ?? "")
    .replace(/_/g, " ")
    .toUpperCase();
  const date = [
    `${part({ weekday: "short" })} ${part({ day: "2-digit" })} ${part({ month: "short" })}`.toUpperCase(),
    zone.toUpperCase(),
    place,
  ]
    .filter(Boolean)
    .join(" · ");
  return { time, date };
}

/** After `dwell` seconds, the next board in the run. `dwell` 0 stays here. */
function useHandover(dwell: number, next: string) {
  useEffect(() => {
    if (dwell <= 0) return;
    const id = window.setTimeout(
      () => window.location.assign(next),
      dwell * 1000,
    );
    return () => window.clearTimeout(id);
  }, [dwell, next]);
}

function Chip({ text, kind }: { text: string; kind: ChipKind }) {
  return (
    <span className={`${s.nx} ${chipClass[chipStyle(kind)]}`}>{text}</span>
  );
}

export function ProgressBoard({
  data,
  today,
  timeZone,
  version,
  commit,
  dwell,
  next,
}: {
  data: ProgressData;
  /** Today in the office, YYYY-MM-DD (server-computed; refreshed with the page). */
  today: string;
  timeZone: string;
  version: string;
  commit: string;
  dwell: number;
  next: string;
}) {
  const clock = useClock(timeZone);
  useHandover(dwell, next);
  useKeepFresh();
  const news = useNews();
  const axis = useMemo(
    () => buildAxis(data.start, today, lastDataDay(data.phases, data.releases)),
    [data, today],
  );
  const overall = overallPct(data.phases);
  const hasNews = news.world.length > 0 || news.ai.length > 0;

  return (
    <div
      className={`${s.screen} ${stencil.variable} ${body.variable} ${mono.variable}`}
    >
      <div className={s.stage}>
        <div className={`${s.board} ${hasNews ? "" : s.noNews}`}>
          <div className={s.strap}>
            AEC-FLOW · BUILD TIMELINE · OFFICE DISPLAY ONLY
          </div>

          <header className={s.head}>
            <div className={s.logo}>
              <svg viewBox="0 0 46 46" aria-hidden="true">
                <rect
                  x="2"
                  y="2"
                  width="42"
                  height="42"
                  fill="none"
                  stroke="#4fd1e8"
                  strokeWidth="3"
                />
                <path
                  d="M10 34 L23 11 L36 34"
                  fill="none"
                  stroke="#eef4ff"
                  strokeWidth="3.4"
                />
                <path d="M15.5 25 H30.5" stroke="#4fd1e8" strokeWidth="3" />
              </svg>
              <div>
                <b>AEC-FLOW</b>
                <small>MANAGEMENT SUITE</small>
              </div>
            </div>
            <div className={s.title}>
              <b>BUILD TIMELINE</b>
              <span>
                {data.phases.length} PHASES · {dayLabel(data.start)} → TODAY ·
                WHAT IS LEFT
              </span>
            </div>
            <div className={s.kpis}>
              <div className={s.kpi}>
                <b>{overall}%</b>
                <span>BUILT</span>
              </div>
              {data.kpis.map((k) => (
                <div key={k.label} className={s.kpi}>
                  <b className={toneClass[k.tone]}>{k.value}</b>
                  <span>{k.label}</span>
                </div>
              ))}
            </div>
            <div className={s.clock}>
              <b>{clock.time}</b>
              <span>{clock.date}</span>
            </div>
          </header>

          <div className={s.mid}>
            <section className={`${s.glass} ${s.gantt}`}>
              <div className={s.gGrid}>
                <div className={s.gHead}>
                  <span>PHASE · BUILT</span>
                  <div className={s.gDays}>
                    {axis.ticks.map((t) => (
                      <span
                        key={t.iso}
                        className={t.today ? s.tickToday : ""}
                        style={{ left: `${t.x}%` }}
                      >
                        <b>{t.label}</b>
                        {t.sub}
                      </span>
                    ))}
                  </div>
                  <span className={s.gNextHead}>NEXT · NO DATES</span>
                </div>
                <div className={s.gBody}>
                  <div className={s.gRow}>
                    <div className={s.gLbl}>
                      <div>
                        <b>
                          <i>LIVE</i>Deploys
                        </b>
                        <em>{commit}</em>
                      </div>
                    </div>
                    <div className={s.gLane}>
                      {data.releases.map((r) => {
                        const x = dayMark(axis, r);
                        return x === null ? null : (
                          <span
                            key={r}
                            className={s.dia}
                            style={{ left: `${x}%` }}
                          />
                        );
                      })}
                    </div>
                    <div className={s.gNext}>
                      {data.deploysNext.map((c) => (
                        <Chip key={c.text} {...c} />
                      ))}
                    </div>
                  </div>
                  {data.phases.map((p) => {
                    const tone = phaseTone[pctTone(p.pct)];
                    return (
                      <div key={p.code} className={s.gRow}>
                        <div className={s.gLbl}>
                          <div>
                            <b>
                              <i>{p.code}</i>
                              {p.name}
                            </b>
                            <em className={tone}>{p.pct}%</em>
                          </div>
                          <div className={s.gBar}>
                            <u
                              className={tone}
                              style={{ width: `${p.pct}%` }}
                            />
                          </div>
                        </div>
                        <div className={s.gLane}>
                          {p.worked.map((w) => {
                            const box = spanBox(axis, w);
                            return box ? (
                              <span
                                key={w.from}
                                className={s.blk}
                                style={{
                                  left: `${box.left}%`,
                                  width: `${box.width}%`,
                                }}
                              />
                            ) : null;
                          })}
                        </div>
                        <div className={s.gNext}>
                          {p.next.length ? (
                            p.next.map((c) => <Chip key={c.text} {...c} />)
                          ) : (
                            <span className={`${s.nx} ${s.nxDone}`}>DONE</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {axis.todayX !== null ? (
                  <span
                    className={s.today}
                    style={{ ["--x" as string]: axis.todayX / 100 }}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            </section>

            <div className={s.side}>
              <section className={`${s.glass} ${s.box}`}>
                <h3>
                  <i />
                  WORKING ON NOW
                </h3>
                <ul>
                  {data.workingOn.map((w) => (
                    <li key={w}>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className={`${s.glass} ${s.box} ${s.miss}`}>
                <h3>
                  <i className={s.dotAm} />
                  MISSING
                </h3>
                <ul>
                  {data.missing.map((m) => {
                    const grey = greyTags.has(m.tag);
                    return (
                      <li key={m.text} className={grey ? s.grey : ""}>
                        <span>{m.text}</span>
                        <span className={`${s.who} ${grey ? s.whoG : ""}`}>
                          {m.tag}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          </div>

          <StatsStrip data={data} version={version} commit={commit} />
          {hasNews ? <NewsBar world={news.world} ai={news.ai} /> : null}

          <div className={s.route}>
            <span>
              ROUTE: AEC-FLOW › PERMITS › <b>[PROGRESS]</b> › NUCLEUS › LOC8 ›
              SIGMA-CMS › AEC-FLOW
            </span>
            <span>
              DATA AS OF {longDate(data.asOf)} · LIVE v{version} · BUILD{" "}
              {commit}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Cyan-label strip of build numbers, scrolling LEFT → RIGHT. The track is doubled so the loop is seamless. */
function StatsStrip({
  data,
  version,
  commit,
}: {
  data: ProgressData;
  version: string;
  commit: string;
}) {
  const items = [
    {
      label: "Live",
      value: `v${version}`,
      tone: undefined as Tone | undefined,
      note: commit,
    },
    ...data.stats,
  ];
  const one = items.map((it, i) => (
    <span key={i} className={s.statsRun}>
      <span className={s.statsIt}>
        <span className={s.statsK}>{it.label}</span>
        <b className={it.tone ? toneClass[it.tone] : ""}>{it.value}</b>
        {it.note ? <i>{it.note}</i> : null}
      </span>
      <span className={s.statsSep} />
    </span>
  ));
  return (
    <div className={s.stats}>
      <div className={s.statsLab}>AEC-FLOW STATS</div>
      <div className={s.statsWin}>
        <div
          className={s.statsTrack}
          style={{ animationDuration: `${Math.max(40, items.length * 8)}s` }}
        >
          {one}
          {one}
        </div>
      </div>
    </div>
  );
}

/**
 * The shared bottom banner, as on /officedash and the Sigma board: BREAKING (blue
 * TOP STORY when nothing is breaking) rotating every 10 s, and the AI & innovation
 * ticker. Not rendered at all when the relay is dead.
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
  const x = feat.length ? feat[fi % feat.length] : null;
  const run = tick.map((n, i) => (
    <span key={i} className={s.aiRun}>
      <span className={s.aiIt}>
        {n.img ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote news photos from many hosts, not worth an image loader
          <img
            src={n.img}
            alt=""
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ) : null}
        <span className={s.aiTx}>
          <b>{n.title}</b>
          <small>
            <em>{n.src || "WORLD"}</em>
            {ago(n.t) ? ` · ${ago(n.t)}` : ""}
          </small>
        </span>
      </span>
      <span className={s.aiSep} />
    </span>
  ));
  return (
    <div className={s.news}>
      {x ? (
        <div className={`${s.brk} ${hot.length ? "" : s.brkTop}`}>
          <div key={fi} className={s.brkSlide}>
            {x.img ? (
              // eslint-disable-next-line @next/next/no-img-element -- see above
              <img
                src={x.img}
                alt=""
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            ) : null}
            <div className={s.brkBx}>
              <span className={s.brkTag}>
                <i />
                {hot.length ? "BREAKING" : "TOP STORY"}
              </span>
              <div className={s.brkHl}>{x.title}</div>
              <div className={s.brkMt}>
                {x.src || "WORLD"}
                {ago(x.t) ? ` · ${ago(x.t)}` : ""}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div />
      )}
      <div className={s.ai}>
        <div className={s.aiLab}>
          <b>{A.length ? "AI" : "WORLD"}</b>
          <span>{A.length ? "INNOVATION" : "NEWS"}</span>
        </div>
        <div className={s.aiWin}>
          <div
            className={s.aiTrack}
            style={{ animationDuration: `${Math.max(60, tick.length * 14)}s` }}
          >
            {run}
            {run}
          </div>
        </div>
      </div>
    </div>
  );
}
