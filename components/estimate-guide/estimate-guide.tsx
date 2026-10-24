"use client";

/**
 * INTERACTIVE-GUIDE for the Estimates editor.
 *
 * The Estimates guide is one definition (lib/guide/registry.ts) run by the
 * shared engine (guide-tour.tsx). This file is only the mount point the
 * Estimates editor imports: Estimates is a protected system, so the editor
 * keeps mounting <EstimateGuide /> and carrying `data-guide` attributes, and
 * nothing in it had to change when the engine learned to run a second guide.
 */

import { ESTIMATES_GUIDE } from "@/lib/guide/registry";
import { GuideTour } from "./guide-tour";

export function EstimateGuide() {
  return <GuideTour guide={ESTIMATES_GUIDE} />;
}
