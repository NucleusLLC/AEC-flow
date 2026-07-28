/**
 * Server-only persistence for the org-wide Practice profile + logo.
 *
 * Single-tenant hedge: there's one firm, so this org config lives in the same
 * gitignored `.app-config.json` the Anthropic key uses (see ai-config.ts) rather
 * than a DB table — no migration, no dev-server restart, takes effect per-request.
 * When the suite goes multi-tenant this moves to a per-org row; call sites stay put.
 *
 * NEVER import this from a client component — it touches the filesystem. The
 * client-safe `PracticeProfile` TYPE + `PRACTICE` defaults live in
 * `lib/data/settings.ts` (which stays fs/prisma-free).
 */
import { PRACTICE, type PracticeProfile } from "@/lib/data/settings";
import { DEFAULT_FONT_ID, selectableFonts } from "@/lib/documents/fonts";
import { readAppConfig, writeAppConfig } from "./app-config-store";

type AppConfig = {
  anthropicApiKey?: string;
  practiceProfile?: Partial<PracticeProfile>;
  /** Logo as a data URL (e.g. "data:image/png;base64,…"); stored inline for portability. */
  logoDataUrl?: string;
  /** Org-wide system monetary unit (ISO code, e.g. "AWG", "USD"); default for every module. */
  currency?: string;
  /** Document footer line (printed on every page of exported documents). */
  footer?: { text?: string; fontFamily?: string; fontSize?: number };
  /**
   * Document typeface, stored as a catalog ID (e.g. "inter") — never a raw CSS
   * family. An ID survives catalog edits and lets an issued document record what
   * it was typeset in. See lib/documents/fonts.ts and directive §11.5.
   */
  documentFontId?: string;
  /** Logo placement on exported documents (position + height in px). */
  logo?: { position?: LogoPosition; size?: number };
};

/**
 * Fallback system currency, used only when neither the stored config nor the
 * SYSTEM_CURRENCY env var supplies one. AWG (Aruban florin) is this practice's
 * standard unit; keep it in step with the same last-resort default in
 * lib/format.ts.
 */
export const DEFAULT_SYSTEM_CURRENCY = "AWG";

export type FooterSettings = { text: string; fontFamily: string; fontSize: number };
export const DEFAULT_FOOTER: FooterSettings = {
  text: "AEC Management Suite",
  fontFamily: "", // "" = inherit the document's default sans-serif
  fontSize: 9,
};

/** Where the logo sits on a document letterhead, and its rendered height (px). */
export type LogoPosition = "left" | "center" | "right";
export type LogoSettings = { position: LogoPosition; size: number };
export const DEFAULT_LOGO: LogoSettings = { position: "left", size: 56 }; // 56px ≈ the prior h-14
const LOGO_POSITIONS: LogoPosition[] = ["left", "center", "right"];
export const MIN_LOGO_SIZE = 24;
export const MAX_LOGO_SIZE = 160;

async function readConfig(): Promise<AppConfig> {
  return (await readAppConfig()) as AppConfig;
}

async function writeConfig(cfg: AppConfig): Promise<void> {
  await writeAppConfig(cfg as Record<string, unknown>);
}

export type PracticeSettings = {
  profile: PracticeProfile;
  logoDataUrl: string | null;
  currency: string;
  footer: FooterSettings;
  logo: LogoSettings;
  /** Catalog ID of the document typeface (see lib/documents/fonts.ts). */
  documentFontId: string;
};

/** Effective practice settings: saved values merged over the built-in defaults. */
export async function getPracticeSettings(): Promise<PracticeSettings> {
  const cfg = await readConfig();
  const pos = cfg.logo?.position;
  return {
    profile: { ...PRACTICE, ...(cfg.practiceProfile ?? {}) },
    logoDataUrl: cfg.logoDataUrl ?? null,
    currency: cfg.currency ?? DEFAULT_SYSTEM_CURRENCY,
    footer: { ...DEFAULT_FOOTER, ...(cfg.footer ?? {}) },
    logo: {
      position: pos && LOGO_POSITIONS.includes(pos) ? pos : DEFAULT_LOGO.position,
      size: cfg.logo?.size ?? DEFAULT_LOGO.size,
    },
    documentFontId: resolveStoredFontId(cfg.documentFontId),
  };
}

/**
 * A stored font ID is only honoured when it still names a selectable catalog
 * entry. A face that was later disabled — say a licence lapsed — must not keep
 * being used just because it sits in an old config row.
 */
function resolveStoredFontId(stored: string | undefined): string {
  if (!stored) return DEFAULT_FONT_ID;
  const match = selectableFonts().find((f) => f.id === stored);
  return match ? match.id : DEFAULT_FONT_ID;
}

/** The document typeface, as a catalog ID. */
export async function getDocumentFontId(): Promise<string> {
  const cfg = await readConfig();
  return resolveStoredFontId(cfg.documentFontId);
}

/**
 * Persists the document typeface. Rejects anything that is not a selectable
 * catalog entry, so an unlicensed or renderer-unsupported face can never be
 * stored — the failure mode the old free-text footer font allowed.
 */
export async function saveDocumentFontId(fontId: string): Promise<void> {
  const match = selectableFonts().find((f) => f.id === fontId);
  if (!match) {
    throw new Error(
      `"${fontId}" is not an available document font. Choose one from Settings → Document Control.`,
    );
  }
  const cfg = await readConfig();
  cfg.documentFontId = match.id;
  await writeConfig(cfg);
}

export async function saveLogoSettings(logo: LogoSettings): Promise<void> {
  const position = LOGO_POSITIONS.includes(logo.position) ? logo.position : DEFAULT_LOGO.position;
  const size = Math.max(MIN_LOGO_SIZE, Math.min(MAX_LOGO_SIZE, Math.round(logo.size) || DEFAULT_LOGO.size));
  const cfg = await readConfig();
  cfg.logo = { position, size };
  await writeConfig(cfg);
}

export async function saveFooter(footer: FooterSettings): Promise<void> {
  const cfg = await readConfig();
  cfg.footer = {
    text: footer.text.slice(0, 200),
    fontFamily: footer.fontFamily.slice(0, 120),
    fontSize: Math.max(5, Math.min(24, Math.round(footer.fontSize) || DEFAULT_FOOTER.fontSize)),
  };
  await writeConfig(cfg);
}

/** The org-wide system monetary unit (used as the default across all modules). */
export async function getSystemCurrency(): Promise<string> {
  const cfg = await readConfig();
  // On serverless (Vercel) the .app-config.json file isn't present/writable, so
  // fall back to a SYSTEM_CURRENCY env var before the hardcoded default. This
  // lets the live deployment set the org currency until config moves to the DB.
  const envCurrency = process.env.SYSTEM_CURRENCY?.trim().toUpperCase() || undefined;
  return cfg.currency ?? envCurrency ?? DEFAULT_SYSTEM_CURRENCY;
}

export async function saveSystemCurrency(currency: string): Promise<void> {
  const code = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new Error("Currency must be a 3-letter ISO code (e.g. AWG, USD, EUR).");
  }
  const cfg = await readConfig();
  cfg.currency = code;
  await writeConfig(cfg);
}

export async function savePracticeProfile(profile: PracticeProfile): Promise<void> {
  const cfg = await readConfig();
  cfg.practiceProfile = profile;
  await writeConfig(cfg);
}

/** Reasonable ceiling so a giant image can't bloat the config file. */
export const MAX_LOGO_BYTES = 1_500_000; // ~1.5 MB of raw data-URL string

export async function saveLogo(dataUrl: string): Promise<void> {
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith("data:image/")) {
    throw new Error("Logo must be an image file.");
  }
  if (trimmed.length > MAX_LOGO_BYTES) {
    throw new Error("Logo is too large — please use an image under ~1 MB.");
  }
  const cfg = await readConfig();
  cfg.logoDataUrl = trimmed;
  await writeConfig(cfg);
}

export async function removeLogo(): Promise<void> {
  const cfg = await readConfig();
  delete cfg.logoDataUrl;
  await writeConfig(cfg);
}
