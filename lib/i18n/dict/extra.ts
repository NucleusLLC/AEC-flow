/**
 * German, Chinese, Japanese and Portuguese: one folder per language, one file
 * per area, with exactly the keys of that area's Spanish and Dutch dictionary
 * (full-coverage.test.ts checks).
 */
import type { Dict, ExtraLang } from "../types";
import { de } from "./de";
import { ja } from "./ja";
import { pt } from "./pt";
import { zh } from "./zh";

export const EXTRA_AREAS: Record<ExtraLang, Record<string, Dict>> = { de, zh, ja, pt };
