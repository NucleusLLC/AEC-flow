"use client";

/**
 * INTERACTIVE-GUIDE on the Estimates landing screen (the project picker a new
 * user sees first at /estimates).
 *
 * The tour needs an open estimate, and the tour's own button lives in the
 * editor. Before an estimate is open there was no button at all, so a new user
 * could not find the guide. This puts the same button on the landing screen, in
 * the same two places. Pressing it cannot run the tour (there is no editor), so
 * it shows ONE card, in the viewer's language, pointing at "New estimate" and
 * saying how to get to the tour. The card stays until it is closed (X, Esc, or
 * the button again); it is read aloud once when the guide is narrated.
 *
 * Mounted from the app shell, NOT from the Estimates screens: those are a
 * protected system and are not touched. So this component works out by itself
 * when it applies:
 *   - the route is /estimates, in a language the guide is offered in;
 *   - the editor's own guide is not on the page (registerEditorGuide), which is
 *     what guarantees there are never two buttons;
 *   - the picker really is on screen, known by its "New estimate" button, found
 *     by its text in the current language because the screen carries no marker.
 *     While an estimate is loading, or another tab of the workspace is open,
 *     that button is not there and neither is this one.
 *
 * Every label sits in its own <span>. A text node beside a conditionally
 * rendered sibling is what browser page translation breaks React on.
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Volume2, VolumeX, X } from "lucide-react";
import { useLanguage, useT } from "@/components/i18n/language-provider";
import {
  GUIDE_PICKER_HINT_ID,
  GUIDE_PICKER_PATH,
  GUIDE_TONE_HEX,
  clampRect,
  guideEnabledFor,
  placeCard,
  type GuideContent,
} from "@/lib/estimates/interactive-guide";
import { guideContentFor } from "@/lib/estimates/interactive-guide-content";
import { readNarrationPref, writeNarrationPref, type NarrationManifest } from "@/lib/guide-narration/timing";
import { GUIDE_CSS, GuideButtons, browserStorage, toRect, useEditorGuideMounted, useNarrationManifest } from "./guide-chrome";
import { GuideNarrationPlayer, primeGuideAudio } from "./narration-player";

/** The picker's "New estimate" button, or null when the picker is not on screen. */
function findPickerTarget(label: string): HTMLElement | null {
  const wanted = label.trim();
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("main button"))) {
    if (el.textContent?.trim() === wanted && el.getClientRects().length > 0) return el;
  }
  return null;
}

/** Counts the times the picker has come on screen, so each visit can be told from the last. */
let pickerVisits = 0;

/**
 * Is the picker on screen? Returns 0 when it is not, and otherwise a number
 * that is different for every time it has appeared (a card opened on one visit
 * must not reopen by itself on the next). Re-checked when the page changes, at
 * most once a frame. Not watched at all while `watch` is false.
 */
function usePickerVisit(watch: boolean, label: string): number {
  const [found, setFound] = useState<{ label: string; visit: number } | null>(null);
  useEffect(() => {
    if (!watch) return;
    let raf = 0;
    let was: boolean | null = null;
    const check = () => {
      raf = 0;
      const on = findPickerTarget(label) !== null;
      if (on === was) return;
      was = on;
      setFound({ label, visit: on ? ++pickerVisits : 0 });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
      setFound(null);
    };
  }, [watch, label]);
  return watch && found !== null && found.label === label ? found.visit : 0;
}

function PickerCard({
  content,
  lang,
  label,
  narration,
  onClose,
}: {
  content: GuideContent;
  lang: string;
  /** The text of the control the card points at. */
  label: string;
  narration: NarrationManifest;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const tailRef = useRef<HTMLSpanElement>(null);

  // Is there a clip for this card? Without one the card is simply silent.
  const narrated = narration.enabled && typeof narration.clips[GUIDE_PICKER_HINT_ID] === "string";
  const [soundOn, setSoundOn] = useState(() => readNarrationPref(browserStorage()));

  // Esc closes the card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Read the card aloud once. Closing it, or muting, silences it at once. The
  // player owns a blob URL, so it is made and disposed with this effect.
  useEffect(() => {
    if (!narrated || !soundOn) return;
    const player = new GuideNarrationPlayer(lang, narration);
    let cancelled = false;
    void player.load(GUIDE_PICKER_HINT_ID).then((url) => {
      if (cancelled || !url) return;
      void player.play(url, () => {});
    });
    return () => {
      cancelled = true;
      player.dispose();
    };
  }, [lang, narration, narrated, soundOn]);

  const toggleSound = () => {
    const next = !soundOn;
    writeNarrationPref(browserStorage(), next);
    setSoundOn(next);
  };

  // Follow the target, exactly as the tour does: positions are written straight
  // to the elements each frame. With no target on the page the card is centred
  // and nothing is outlined.
  useEffect(() => {
    const root = rootRef.current;
    const ring = ringRef.current;
    const card = cardRef.current;
    const tail = tailRef.current;
    if (!root || !ring || !card || !tail) return;
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const el = findPickerTarget(label);
      if (!el) {
        ring.style.display = "none";
        card.style.transform = `translate3d(${Math.round(Math.max(12, (viewport.width - card.offsetWidth) / 2))}px, ${Math.round(Math.max(12, (viewport.height - card.offsetHeight) / 2))}px, 0)`;
        card.dataset.side = "over";
        root.dataset.ready = "1";
        return;
      }
      const target = toRect(el.getBoundingClientRect());
      const lit = clampRect(
        { left: target.left - 4, top: target.top - 4, width: target.width + 8, height: target.height + 8 },
        viewport,
        3,
      );
      ring.style.display = "";
      ring.style.left = `${lit.left}px`;
      ring.style.top = `${lit.top}px`;
      ring.style.width = `${lit.width}px`;
      ring.style.height = `${lit.height}px`;

      // Keep the card clear of the floating button on narrower screens.
      const floating = document.querySelector("[data-guide-button][data-float]");
      const reserved =
        floating && floating.getClientRects().length > 0 ? Math.max(0, viewport.height - floating.getBoundingClientRect().top) : 0;
      const at = placeCard({
        target: lit,
        card: { width: card.offsetWidth, height: card.offsetHeight },
        viewport: { width: viewport.width, height: viewport.height - reserved },
      });
      card.style.transform = `translate3d(${Math.round(at.x)}px, ${Math.round(at.y)}px, 0)`;
      card.dataset.side = at.side;
      const along = `${Math.round(at.arrow - 7)}px`;
      const vertical = at.side === "bottom" || at.side === "top";
      tail.style.left = vertical ? along : "";
      tail.style.top = vertical ? "" : along;
      root.dataset.ready = "1";
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [label]);

  return (
    <div
      ref={rootRef}
      className="aeg-root"
      data-guide-overlay=""
      data-guide-picker=""
      data-step={GUIDE_PICKER_HINT_ID}
      data-narration={narrated && soundOn ? "1" : "0"}
      style={{ ["--aeg" as string]: GUIDE_TONE_HEX.pink }}
    >
      <style>{GUIDE_CSS}</style>
      <div ref={ringRef} className="aeg-ring" aria-hidden="true" />
      <div ref={cardRef} className="aeg-card" role="region" aria-label={content.ui.label} lang={lang}>
        <span ref={tailRef} className="aeg-tail" aria-hidden="true" />
        <div style={{ padding: "12px 14px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="aeg-title" data-guide-title="" style={{ flex: 1, minWidth: 0 }}>
              {content.picker.title}
            </span>
            {narrated ? (
              <button
                type="button"
                className="aeg-btn"
                style={{ padding: "0 6px" }}
                data-guide-sound=""
                aria-pressed={soundOn}
                onClick={toggleSound}
                aria-label={soundOn ? content.ui.mute : content.ui.unmute}
                title={soundOn ? content.ui.mute : content.ui.unmute}
              >
                <span style={{ display: "inline-flex" }} aria-hidden="true">
                  {soundOn ? <Volume2 width={14} height={14} /> : <VolumeX width={14} height={14} />}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className="aeg-btn"
              style={{ padding: "0 6px" }}
              data-guide-close=""
              onClick={onClose}
              aria-label={content.ui.close}
              title={content.ui.close}
            >
              <X width={14} height={14} aria-hidden="true" />
            </button>
          </div>
          <div aria-live="polite" style={{ marginTop: 6 }}>
            <p data-guide-body="" style={{ margin: 0 }}>
              <span>{content.picker.body}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mounted once, in the app shell. Renders nothing except on the Estimates landing screen. */
export function EstimateGuidePicker() {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const t = useT();
  const editorGuide = useEditorGuideMounted();

  const here = pathname === GUIDE_PICKER_PATH;
  const content = here && guideEnabledFor(lang) ? guideContentFor(lang) : null;
  // The button on the picker, as that screen labels it in this language.
  const label = t("New estimate");
  const visit = usePickerVisit(content !== null && !editorGuide, label);
  const show = content !== null && !editorGuide && visit > 0;

  // The visit and the language the card was opened in. Leaving the picker, or
  // changing language, closes it, and coming back does not reopen it: `open`
  // is derived, never stored twice.
  const [opened, setOpened] = useState<{ visit: number; lang: string } | null>(null);
  const open = show && opened !== null && opened.visit === visit && opened.lang === lang;

  const manifest = useNarrationManifest(lang, show);

  if (!show || !content) return null;

  return (
    <>
      <GuideButtons
        lit={open}
        title={open ? content.ui.stop : content.ui.start}
        onPress={() => {
          // Inside the click, so browsers that only allow sound from a gesture let the clip play.
          if (!open) primeGuideAudio();
          setOpened(open ? null : { visit, lang });
        }}
      />
      {open
        ? createPortal(
            <PickerCard content={content} lang={lang} label={label} narration={manifest} onClose={() => setOpened(null)} />,
            document.body,
          )
        : null}
    </>
  );
}
