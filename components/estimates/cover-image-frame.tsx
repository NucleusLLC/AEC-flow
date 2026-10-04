/* eslint-disable @next/next/no-img-element -- data URLs, print context */
import type { CSSProperties } from "react";
import { coverCropBox, frameRatio, type CoverFit } from "@/lib/estimates/cover-fit";

/**
 * The image cropped to a fixed-ratio frame. It fills its parent (which sets the
 * size and ratio), positioned with the same geometry the editor uses, so the
 * printed crop is the one the user chose. Never stretches: when the image's own
 * ratio is unknown (an image saved before it was recorded) it falls back to
 * object-fit cover at the chosen position.
 */
export function CroppedImage({ image, fit, alt = "" }: { image: string; fit: CoverFit; alt?: string }) {
  const fr = frameRatio(fit.frame);
  if (fr == null || !fit.imageRatio) {
    return (
      <img
        src={image}
        alt={alt}
        draggable={false}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `${fit.x}% ${fit.y}%`, display: "block" }}
      />
    );
  }
  const b = coverCropBox(fit.imageRatio, fr, fit);
  return (
    <img
      src={image}
      alt={alt}
      draggable={false}
      style={{ position: "absolute", left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%`, maxWidth: "none", display: "block" }}
    />
  );
}

/**
 * Cover-page hero: fits inside whatever space its parent gives it.
 * "original" prints the whole image at its own proportions; a fixed ratio
 * draws the largest frame of that ratio that fits, and crops into it.
 */
export function CoverImageFrame({ image, fit, frameStyle }: { image: string; fit: CoverFit; frameStyle?: CSSProperties }) {
  const fr = frameRatio(fit.frame);
  if (fr == null) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img
          src={image}
          alt=""
          style={{ maxWidth: "100%", maxHeight: "100%", width: "auto", height: "auto", objectFit: "contain", display: "block", ...frameStyle }}
        />
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: "100%", containerType: "size", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          width: `min(100cqw, calc(100cqh * ${fr}))`,
          height: `min(100cqh, calc(100cqw / ${fr}))`,
          ...frameStyle,
        }}
      >
        <CroppedImage image={image} fit={fit} />
      </div>
    </div>
  );
}
