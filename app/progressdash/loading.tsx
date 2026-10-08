import { Saira_Stencil_One, JetBrains_Mono } from "next/font/google";
import s from "../officedash/loading.module.css";

const stencil = Saira_Stencil_One({ weight: "400", subsets: ["latin"], variable: "--ld-stencil", fallback: ["Impact", "sans-serif"], adjustFontFallback: false });
const mono = JetBrains_Mono({ weight: ["400", "600"], subsets: ["latin"], variable: "--ld-mono", fallback: ["Consolas", "monospace"], adjustFontFallback: false });

/**
 * Shown while /progressdash loads — on the TV that is every handover from the
 * permits sheet. The /officedash loader's stage and styles (shared on purpose, so the
 * two boards fade into each other), with this board's title and checks.
 */
export default function ProgressDashLoading() {
  return (
    <div className={`${s.screen} ${stencil.variable} ${mono.variable}`} role="status" aria-live="polite">
      <div className={s.stage}>
        <div className={s.box}>
          <div className={s.radar} aria-hidden="true">
            <span className={s.ring} />
            <span className={s.ring2} />
            <span className={s.sweep} />
            <span className={s.blip} />
          </div>
          <div className={s.text}>
            <div className={s.title}>PROGRESS</div>
            <div className={s.sub}>ESTABLISHING UPLINK · AEC-FLOW / PROGRESSDASH</div>
            <ul className={s.checks}>
              <li style={{ animationDelay: "0s" }}>BUILD PHASES</li>
              <li style={{ animationDelay: "0.35s" }}>RELEASES</li>
              <li style={{ animationDelay: "0.7s" }}>WORKING ON NOW</li>
              <li style={{ animationDelay: "1.05s" }}>MISSING</li>
            </ul>
            <div className={s.bar}>
              <i />
            </div>
          </div>
        </div>
        <div className={s.foot}>STAND BY</div>
      </div>
    </div>
  );
}
