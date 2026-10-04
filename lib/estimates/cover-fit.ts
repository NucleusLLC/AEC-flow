/**
 * Cover-page image framing — how the project image/rendering sits in its frame
 * on the Estimate cover page, without ever stretching it.
 *
 * Two modes:
 *  - "original": the frame takes the image's own proportions. The whole image
 *    prints, nothing is cut. This is the default (and what old estimates get).
 *  - a fixed ratio (16:9, 3:2, 4:3, 1:1): the image fills the frame and the
 *    overflow is cropped. `x`/`y` (0–100) choose WHICH part stays in view and
 *    `zoom` (1–3) crops tighter. The image is always scaled uniformly, so it is
 *    cropped, never distorted.
 *
 * The geometry is computed here, in percentages of the frame, so the editor
 * preview and the printed page show exactly the same crop.
 */

export const COVER_FRAMES = ["original", "16:9", "3:2", "4:3", "1:1"] as const;
export type CoverFrame = (typeof COVER_FRAMES)[number];

export type CoverFit = {
  frame: CoverFrame;
  /** Crop window position, 0 = left edge of the image, 100 = right edge. */
  x: number;
  /** Crop window position, 0 = top edge of the image, 100 = bottom edge. */
  y: number;
  /** 1 = the smallest crop that fills the frame; up to 3 = tighter crop. */
  zoom: number;
  /** The image's own width / height, recorded at upload. */
  imageRatio?: number;
};

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 3;

export const DEFAULT_COVER_FIT: CoverFit = { frame: "original", x: 50, y: 50, zoom: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Frame width / height for a fixed ratio; null for "original". */
export function frameRatio(frame: CoverFrame): number | null {
  if (frame === "original") return null;
  const [w, h] = frame.split(":").map(Number);
  return w / h;
}

/** Accepts whatever was saved (or nothing) and returns a valid fit. */
export function normalizeCoverFit(v: unknown): CoverFit {
  const o = (v && typeof v === "object" ? v : {}) as Partial<CoverFit>;
  const frame = COVER_FRAMES.includes(o.frame as CoverFrame) ? (o.frame as CoverFrame) : "original";
  const num = (n: unknown, d: number) => (typeof n === "number" && Number.isFinite(n) ? n : d);
  const ir = num(o.imageRatio, NaN);
  return {
    frame,
    x: clamp(num(o.x, 50), 0, 100),
    y: clamp(num(o.y, 50), 0, 100),
    zoom: clamp(num(o.zoom, 1), ZOOM_MIN, ZOOM_MAX),
    ...(ir > 0 ? { imageRatio: ir } : {}),
  };
}

/**
 * Where the image sits inside a fixed-ratio frame, as percentages of the frame:
 * the image is scaled uniformly to cover the frame (times zoom), then shifted so
 * the crop window lands at x/y. `overflowX/Y` say how far it can pan (0 = that
 * axis has nothing to pan).
 */
export function coverCropBox(imageRatio: number, frameR: number, fit: Pick<CoverFit, "x" | "y" | "zoom">) {
  const z = clamp(fit.zoom, ZOOM_MIN, ZOOM_MAX);
  // Height-limited when the image is wider than the frame, width-limited otherwise.
  const width = (imageRatio >= frameR ? (imageRatio / frameR) * 100 : 100) * z;
  const height = (imageRatio >= frameR ? 100 : (frameR / imageRatio) * 100) * z;
  const overflowX = width - 100;
  const overflowY = height - 100;
  return {
    width,
    height,
    left: -overflowX * (clamp(fit.x, 0, 100) / 100),
    top: -overflowY * (clamp(fit.y, 0, 100) / 100),
    overflowX,
    overflowY,
  };
}

/**
 * A drag of (dx, dy) pixels on a frame of (frameW, frameH) pixels, turned into a
 * new x/y. Dragging the image right shows more of its left side, so x goes down.
 */
export function panCoverFit(
  fit: CoverFit,
  dx: number,
  dy: number,
  frameW: number,
  frameH: number,
  imageRatio: number,
): CoverFit {
  const fr = frameRatio(fit.frame);
  if (fr == null || frameW <= 0 || frameH <= 0) return fit;
  const box = coverCropBox(imageRatio, fr, fit);
  const pxX = (box.overflowX / 100) * frameW;
  const pxY = (box.overflowY / 100) * frameH;
  return {
    ...fit,
    x: pxX > 0 ? clamp(fit.x - (dx / pxX) * 100, 0, 100) : fit.x,
    y: pxY > 0 ? clamp(fit.y - (dy / pxY) * 100, 0, 100) : fit.y,
  };
}
