/** de: every area of the app. Keys match the Spanish and Dutch area files exactly (full-coverage.test.ts). */
import type { Dict } from "../../types";
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
import { billing } from "./billing";

export const de: Record<string, Dict> = {
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
  billing,
};
