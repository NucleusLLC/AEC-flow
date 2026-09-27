/**
 * Every area dictionary, in one list. Add a new area file here. Areas exist so
 * that strings live next to the part of the app they belong to; a key may
 * appear in more than one area only with the same translation (coverage.test.ts
 * checks).
 */
import type { AreaDict } from "../types";
import { core } from "./core";

export const AREAS: Record<string, AreaDict> = {
  core,
};
