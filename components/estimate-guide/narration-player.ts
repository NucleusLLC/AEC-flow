/**
 * INTERACTIVE-GUIDE narration, browser side: fetching the clips and the one
 * <audio> element they are played through. No React here; the overlay drives it.
 *
 * Everything in this file fails quiet. A clip that cannot be fetched, a server
 * that answers "no clip" (204), a browser that refuses to play: each resolves to
 * "nothing to play" and the guide carries on silently, exactly as it does with
 * narration off. Nothing is thrown and nothing is written to the console.
 */
import { clipIdFor } from "@/lib/guide/definition";
import { NARRATION_OFF, narrationClipUrl, parseNarrationManifest, type NarrationManifest } from "@/lib/guide-narration/timing";

/** The manifest address of a guide. Estimates keeps the address it always had (no guide named). */
export function narrationManifestUrl(lang: string, guideId: string): string {
  const guide = guideId === "estimates" ? "" : `&guide=${encodeURIComponent(guideId)}`;
  return `/api/guide-narration?lang=${encodeURIComponent(lang)}${guide}`;
}

/** Ask the server whether a guide is narrated in this language. Off on any problem. */
export async function fetchNarrationManifest(lang: string, guideId: string, signal?: AbortSignal): Promise<NarrationManifest> {
  try {
    const response = await fetch(narrationManifestUrl(lang, guideId), {
      signal,
      credentials: "same-origin",
      headers: { accept: "application/json" },
    });
    if (!response.ok) return NARRATION_OFF;
    return parseNarrationManifest(await response.json());
  } catch {
    return NARRATION_OFF;
  }
}

// ---------------------------------------------------------------------------
// The one <audio> element
// ---------------------------------------------------------------------------

let shared: HTMLAudioElement | null = null;

/** A fraction of a second of silence, built here rather than shipped as a literal. */
function silenceUrl(): string {
  const samples = 400;
  const bytes = new Uint8Array(44 + samples).fill(128);
  const view = new DataView(bytes.buffer);
  const ascii = (at: number, text: string) => [...text].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, "data");
  view.setUint32(40, samples, true);
  return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
}

/**
 * Call from the click that starts the guide. Browsers that only let sound start
 * inside a user gesture (Safari) remember that THIS element was started by one,
 * so the clips that follow, which start from timers, are allowed to play.
 */
export function primeGuideAudio(): void {
  try {
    if (typeof Audio === "undefined") return;
    if (!shared) {
      shared = new Audio();
      shared.preload = "auto";
    }
    const url = silenceUrl();
    shared.src = url;
    const done = () => URL.revokeObjectURL(url);
    shared.play().then(done, done);
  } catch {
    /* no audio in this browser: the guide runs silent */
  }
}

function audioElement(): HTMLAudioElement | null {
  try {
    if (typeof Audio === "undefined") return null;
    if (!shared) {
      shared = new Audio();
      shared.preload = "auto";
    }
    return shared;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Clips
// ---------------------------------------------------------------------------

export type GuidePlayback = {
  /** Length of the clip in ms once known, else null. */
  durationMs: number | null;
};

/**
 * The clips of one run of the guide. Each is fetched once (the browser keeps it
 * afterwards: the URL carries the clip's version) and held as a blob, so asking
 * for the next step's clip ahead of time makes it start the instant its card
 * arrives.
 */
export class GuideNarrationPlayer {
  private readonly clips = new Map<string, Promise<string | null>>();
  private disposed = false;
  private onEnd: (() => void) | null = null;

  constructor(
    private readonly lang: string,
    private readonly manifest: NarrationManifest,
    /** The guide's clip namespace: "" for Estimates (lib/guide/definition.ts). */
    private readonly namespace: string = "",
  ) {}

  has(stepId: string): boolean {
    return this.manifest.enabled && typeof this.manifest.clips[stepId] === "string";
  }

  /** Fetch a step's clip (once). Resolves to a blob URL, or null when there is none. */
  load(stepId: string): Promise<string | null> {
    if (this.disposed || !this.has(stepId)) return Promise.resolve(null);
    let pending = this.clips.get(stepId);
    if (!pending) {
      pending = (async () => {
        try {
          const response = await fetch(narrationClipUrl(this.lang, clipIdFor({ clipNamespace: this.namespace }, stepId), this.manifest.clips[stepId]), {
            credentials: "same-origin",
          });
          // 204: no clip (no key, switched off, Fish Audio unavailable). Not an error.
          if (response.status !== 200) return null;
          if (!(response.headers.get("content-type") ?? "").startsWith("audio/")) return null;
          const blob = await response.blob();
          if (this.disposed || blob.size === 0) return null;
          return URL.createObjectURL(blob);
        } catch {
          return null;
        }
      })();
      this.clips.set(stepId, pending);
    }
    return pending;
  }

  /**
   * Play a loaded clip from its start. Resolves once it is playing, with its
   * length, or to null when the browser would not play it. `onEnd` is called
   * exactly once: when the clip finishes, or fails part-way.
   */
  async play(url: string, onEnd: () => void): Promise<GuidePlayback | null> {
    const audio = audioElement();
    if (!audio || this.disposed) return null;
    this.stop();
    try {
      let fired = false;
      const end = () => {
        if (fired) return;
        fired = true;
        if (this.onEnd === end) this.onEnd = null;
        onEnd();
      };
      this.onEnd = end;
      audio.onended = end;
      audio.onerror = end;
      audio.src = url;
      audio.currentTime = 0;
      await audio.play();
      // Stopped (Next, Back, Esc) while play() was still starting.
      if (this.onEnd !== end) return null;
      const seconds = audio.duration;
      return { durationMs: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : null };
    } catch {
      // Autoplay blocked, or the clip would not decode: carry on silently.
      this.stop();
      return null;
    }
  }

  /** Pause in place (the Pause button). */
  pause(): void {
    try {
      shared?.pause();
    } catch {
      /* nothing playing */
    }
  }

  /** Continue a paused clip (Resume). Does nothing when no clip is in progress. */
  resume(): void {
    try {
      if (shared && this.onEnd && shared.paused && !shared.ended) void shared.play().catch(() => {});
    } catch {
      /* nothing to resume */
    }
  }

  /** Silence at once and forget the clip in progress. Its `onEnd` is NOT called. */
  stop(): void {
    this.onEnd = null;
    const audio = shared;
    if (!audio) return;
    try {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    } catch {
      /* already stopped */
    }
  }

  /** End of the tour: stop, and release every blob. */
  dispose(): void {
    this.disposed = true;
    this.stop();
    for (const pending of this.clips.values()) {
      void pending.then((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    }
    this.clips.clear();
    try {
      shared?.removeAttribute("src");
      shared?.load();
    } catch {
      /* nothing loaded */
    }
  }
}
