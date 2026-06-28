/**
 * Server-only app config — currently just the Anthropic API key used by the
 * AI-Fetch feature. Persisted to a gitignored JSON file at the project root and
 * read per-request, so a key saved in Settings takes effect without a restart.
 *
 * Resolution order: process.env.ANTHROPIC_API_KEY (deploy-managed) wins over the
 * key saved through the Settings UI. NEVER import this from a client component —
 * it touches the filesystem and would hold a secret.
 */
import { promises as fs } from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), ".app-config.json");

type AppConfig = { anthropicApiKey?: string };

async function readConfig(): Promise<AppConfig> {
  try {
    return JSON.parse(await fs.readFile(CONFIG_PATH, "utf8")) as AppConfig;
  } catch {
    return {};
  }
}

async function writeConfig(cfg: AppConfig): Promise<void> {
  await fs.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

/** The effective key: env var (deploy-managed) takes precedence over the saved one. */
export async function getAnthropicApiKey(): Promise<string | undefined> {
  const env = process.env.ANTHROPIC_API_KEY?.trim();
  if (env) return env;
  const saved = (await readConfig()).anthropicApiKey?.trim();
  return saved || undefined;
}

export async function setAnthropicApiKey(key: string): Promise<void> {
  const cfg = await readConfig();
  const trimmed = key.trim();
  if (trimmed) cfg.anthropicApiKey = trimmed;
  else delete cfg.anthropicApiKey;
  await writeConfig(cfg);
}

export type AnthropicKeyStatus = {
  configured: boolean;
  /** Where the active key comes from: the environment (read-only here) or the saved file. */
  source: "env" | "saved" | null;
  /** Masked preview, never the full key. */
  masked: string | null;
};

function mask(key: string): string {
  const k = key.trim();
  return k.length <= 10 ? "••••••" : `${k.slice(0, 6)}…${k.slice(-4)}`;
}

export async function getAnthropicKeyStatus(): Promise<AnthropicKeyStatus> {
  const env = process.env.ANTHROPIC_API_KEY?.trim();
  if (env) return { configured: true, source: "env", masked: mask(env) };
  const saved = (await readConfig()).anthropicApiKey?.trim();
  return saved
    ? { configured: true, source: "saved", masked: mask(saved) }
    : { configured: false, source: null, masked: null };
}
