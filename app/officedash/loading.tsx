import { Saira_Stencil_One, JetBrains_Mono } from "next/font/google";
import s from "./loading.module.css";

const stencil = Saira_Stencil_One({ weight: "400", subsets: ["latin"], variable: "--ld-stencil", fallback: ["Impact", "sans-serif"], adjustFontFallback: false });
const mono = JetBrains_Mono({ weight: ["400", "600"], subsets: ["latin"], variable: "--ld-mono", fallback: ["Consolas", "monospace"], adjustFontFallback: false });

/**
 * Shown while /officedash gathers its records — on the TV that is every handover
 * back from the Sigma board. Same dark-blue stage as the board, so the swap is
 * a fade, not a flash: a radar sweep, the sheet title, and the four checks the
 * board is running.
 */
export default function OfficeDashLoading() {
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
            <div className={s.title}>SITREP</div>
            <div className={s.sub}>ESTABLISHING UPLINK · AEC-FLOW / OFFICEDASH</div>
            <ul className={s.checks}>
              <li style={{ animationDelay: "0s" }}>ENGAGED PROJECTS</li>
              <li style={{ animationDelay: "0.35s" }}>UNSIGNED PIPELINE</li>
              <li style={{ animationDelay: "0.7s" }}>BUILDING PERMITS</li>
              <li style={{ animationDelay: "1.05s" }}>ORDERS OF THE DAY</li>
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
