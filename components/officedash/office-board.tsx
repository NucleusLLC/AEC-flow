"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Barlow_Condensed, JetBrains_Mono, Saira_Stencil_One } from "next/font/google";
import { mil, pages, type Board, type Lamp, type PermitRow, type PipelineStage } from "@/lib/officedash/board";
import s from "./office-board.module.css";

const stencil = Saira_Stencil_One({ weight: "400", subsets: ["latin"], variable: "--od-stencil" });
const body = Barlow_Condensed({ weight: ["400", "500", "600", "700"], subsets: ["latin"], variable: "--od-body" });
const mono = JetBrains_Mono({ weight: ["400", "600", "700"], subsets: ["latin"], variable: "--od-mono" });

/** Rows per page and seconds per page — the board rotates when a list is longer. */
const PROJECT_ROWS = 11;
const PERMIT_ROWS = 4;
const CHASE_ROWS = 6;
const ROTATE_SECONDS = 15;
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
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!now) return { time: "----", date: "" };
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone, ...o }).format(now);
  const time = part({ hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", "");
  const date = `${part({ weekday: "short" })} ${part({ day: "2-digit" })} ${part({ month: "short" })} ${part({ year: "numeric" })}`.toUpperCase();
  return { time, date };
}

/** One tick per ROTATE_SECONDS; each list takes its page from it. */
function useTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), ROTATE_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, []);
  return tick;
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

function deadlineText(p: PermitRow) {
  if (!p.deadline) return { label: "—", cls: "" };
  const d = p.deadline.days;
  const when = d < 0 ? `${-d}D LATE` : d === 0 ? "TODAY" : `IN ${d}D`;
  return { label: `${p.deadline.kind} ${mil(p.deadline.date)} · ${when}`, cls: p.urgency === "late" ? s.red : p.urgency === "soon" ? s.amber : "" };
}

export function OfficeBoard({ board, firmName, timeZone }: { board: Board; firmName: string; timeZone: string }) {
  const clock = useClock(timeZone);
  const tick = useTick();
  useKeepFresh();

  const projectPages = useMemo(() => pages(board.projects, PROJECT_ROWS), [board.projects]);
  const permitPages = useMemo(() => pages(board.permits, PERMIT_ROWS), [board.permits]);
  const projectPage = tick % projectPages.length;
  const permitPage = tick % permitPages.length;
  const { counts } = board;

  return (
    <div className={`${s.screen} ${stencil.variable} ${body.variable} ${mono.variable}`}>
      <div className={s.stage}>
        <Axonometric />
        <div className={s.ui}>
          <header className={`${s.glass} ${s.head}`}>
            <span className={s.title}>SITREP · {firmName.toUpperCase()}</span>
            <span className={s.kpis}>
              <span><b>{counts.engaged}</b>ENGAGED</span>
              <span><b className={counts.late ? s.red : ""}>{counts.late}</b>PAST TARGET</span>
              <span><b>{counts.onHold}</b>ON HOLD</span>
              <span><b>{counts.unsigned}</b>UNSIGNED</span>
              <span><b>{counts.permitsOpen}</b>PERMITS OPEN</span>
            </span>
            <span className={s.clock}>
              <b>{clock.time} HRS</b>
              <span>{clock.date}</span>
            </span>
            <span className={s.titleBlock}>
              SHEET <b>OD-01</b>
              <br />
              SCALE <b>NTS</b> · REV <b>{mil(board.today)}</b>
              <br />
              AEC-FLOW / OFFICEDASH
            </span>
          </header>

          <div className={s.mid}>
            <section className={`${s.glass} ${s.panel}`}>
              <div className={s.panelHead}>
                <h2>ENGAGED PROJECTS</h2>
                {projectPages.length > 1 ? <span className={s.pager}>PAGE {projectPage + 1}/{projectPages.length}</span> : null}
              </div>
              <table className={s.table}>
                <colgroup>
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "27%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "16%" }} />
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
              <div className={s.chase}>
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

          <section className={`${s.glass} ${s.permits}`}>
            <div className={s.panelHead}>
              <h2>BUILDING PERMITS</h2>
              {permitPages.length > 1 ? <span className={s.pager}>PAGE {permitPage + 1}/{permitPages.length}</span> : <span className={s.pager}>OPEN FILES</span>}
            </div>
            <table className={s.table}>
              <colgroup>
                <col style={{ width: "11%" }} />
                <col style={{ width: "25%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "5%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "26%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>REF</th>
                  <th>PROJECT / FILE</th>
                  <th>STATUS</th>
                  <th>VER</th>
                  <th>SUBMITTED</th>
                  <th className={s.right}>DAYS IN</th>
                  <th>NEXT DEADLINE</th>
                </tr>
              </thead>
              <tbody>
                {permitPages[permitPage].map((p) => {
                  const dl = deadlineText(p);
                  return (
                    <tr key={p.id}>
                      <td className={s.job}>{p.reference}</td>
                      <td className={s.name}>{(p.project ?? p.title).toUpperCase()}</td>
                      <td>{PERMIT_STATUS[p.status] ?? p.status}</td>
                      <td className={s.monoCell}>{p.version ? `V${p.version}` : "—"}</td>
                      <td className={s.monoCell}>{p.submittedAt ? mil(p.submittedAt) : "NOT YET"}</td>
                      <td className={`${s.right} ${s.monoCell}`}>{p.daysIn ?? "—"}</td>
                      <td className={`${s.monoCell} ${dl.cls}`}>{dl.label}</td>
                    </tr>
                  );
                })}
                {board.permits.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={s.empty}>NO OPEN PERMIT FILES</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>

          <footer className={`${s.glass} ${s.foot}`}>
            <span className={s.footLabel}>ORDERS</span>
            <span className={s.orders}>
              {board.orders.slice(0, 4).map((o, i) => (
                <span key={i} className={o.severity === "red" ? s.red : o.severity === "amber" ? s.amber : ""}>
                  <i>{String(i + 1).padStart(2, "0")}</i>
                  {o.text}
                </span>
              ))}
              {board.orders.length === 0 ? <span>ALL CLEAR</span> : null}
            </span>
            <span className={s.legend}>
              <span><span className={`${s.lamp} ${s.lampG}`} />ON TRACK</span>
              <span><span className={`${s.lamp} ${s.lampA}`} />NO PHASE</span>
              <span><span className={`${s.lamp} ${s.lampR}`} />LATE</span>
            </span>
          </footer>
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
