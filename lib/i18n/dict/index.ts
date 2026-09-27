/**
 * Every area dictionary, in one list. Add a new area file here. Areas exist so
 * that strings live next to the part of the app they belong to; a key may
 * appear in more than one area only with the same translation (coverage.test.ts
 * checks).
 */
import type { AreaDict } from "../types";
import { core } from "./core";
import { estimates } from "./estimates";
import { constructionAdmin } from "./constructionAdmin";
import { development } from "./development";
import { commercial } from "./commercial";
import { proposals } from "./proposals";
import { projects } from "./projects";
import { drawings } from "./drawings";
import { shell } from "./shell";
import { workspace } from "./workspace";

export const AREAS: Record<string, AreaDict> = {
  core,
  estimates,
  constructionAdmin,
  development,
  commercial,
  proposals,
  projects,
  drawings,
  shell,
  workspace,
};
