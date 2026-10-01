/**
 * Error tracking, stage one: no vendor, no table.
 *
 * Every error the server hits while handling a request, and every uncaught
 * error in a browser, becomes ONE log line:
 *
 *   [aecflow-error] {"kind":"server","digest":"2856743012","route":"/projects/[id]",…}
 *
 * Vercel keeps the function logs, so searching them for `[aecflow-error]` is the
 * error list, and searching for a digest finds the exact failure a user saw:
 * the error pages show the same digest as "ref", and the Report button puts it
 * into the bug report.
 *
 * Pure and runtime-neutral (no node: imports): instrumentation runs in both the
 * Node.js and the Edge runtime.
 *
 * What is NOT logged: query strings, the token in a reset / invite / verify
 * link, email addresses, API keys, bearer tokens and other long secrets inside a
 * message or stack. A log line is read by whoever can read the logs; it must
 * not become a way to take over an account.
 */

export const ERROR_LOG_TAG = "[aecflow-error]";

export const MAX_MESSAGE_CHARS = 500;
export const MAX_STACK_LINES = 8;
export const MAX_STACK_LINE_CHARS = 200;

/** Routes whose last path segment is a credential. */
const TOKEN_ROUTES = ["/reset-password/", "/invite/", "/verify-email/"];

/** Masks secrets that can turn up inside an error message or a stack. */
export function redactText(input: string): string {
  return (
    input
      // Anthropic / Resend / Supabase-style keys and JWTs.
      .replace(/\bsk-[A-Za-z0-9_-]{8,}/g, "[secret]")
      .replace(/\bre_[A-Za-z0-9_]{8,}/g, "[secret]")
      .replace(/\bsbp_[A-Za-z0-9]{8,}/g, "[secret]")
      .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[secret]")
      .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 [secret]")
      // Connection strings carry a password.
      .replace(/\b(postgres(?:ql)?|mysql|redis):\/\/[^\s"']+/gi, "$1://[secret]")
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
      // Long hex or base64url runs: reset tokens, invite tokens, signed-URL tokens.
      .replace(/\b[a-f0-9]{32,}\b/gi, "[token]")
      .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[token]")
  );
}

/** Drops the query string and the credential segment of a token route. */
export function redactPath(path: string): string {
  let p = (path || "").split(/[?#]/)[0] || "/";
  for (const route of TOKEN_ROUTES) {
    if (p.startsWith(route) && p.length > route.length) {
      p = `${route}[token]`;
    }
  }
  return redactText(p).slice(0, 300);
}

function clampMessage(s: unknown): string {
  const text = typeof s === "string" ? s : s == null ? "" : String(s);
  const red = redactText(text);
  return red.length > MAX_MESSAGE_CHARS ? `${red.slice(0, MAX_MESSAGE_CHARS)}…` : red;
}

function clampStack(stack: unknown): string[] | undefined {
  if (typeof stack !== "string" || !stack) return undefined;
  return stack
    .split("\n")
    .slice(1, 1 + MAX_STACK_LINES)
    .map((l) => redactText(l.trim()).slice(0, MAX_STACK_LINE_CHARS))
    .filter(Boolean);
}

export type BuildInfo = { version: string; build: string };

export type ServerErrorRecord = {
  kind: "server";
  at: string;
  digest?: string;
  name: string;
  message: string;
  stack?: string[];
  method: string;
  path: string;
  route: string;
  routeType: string;
  renderSource?: string;
  version: string;
  build: string;
};

/** The record for an error Next.js reports through `onRequestError`. */
export function serverErrorRecord(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath: string; routeType: string; renderSource?: string },
  build: BuildInfo,
  now: Date = new Date(),
): ServerErrorRecord {
  const e = (error && typeof error === "object" ? error : {}) as {
    name?: unknown;
    message?: unknown;
    stack?: unknown;
    digest?: unknown;
  };
  return {
    kind: "server",
    at: now.toISOString(),
    digest: typeof e.digest === "string" ? e.digest : undefined,
    name: typeof e.name === "string" ? e.name : "Error",
    message: clampMessage(error instanceof Error || e.message !== undefined ? e.message : error),
    stack: clampStack(e.stack),
    method: String(request.method || "").slice(0, 10),
    path: redactPath(request.path),
    route: redactPath(context.routePath),
    routeType: context.routeType,
    renderSource: context.renderSource,
    version: build.version,
    build: build.build,
  };
}

export type ClientErrorInput = {
  source?: unknown;
  message?: unknown;
  name?: unknown;
  stack?: unknown;
  digest?: unknown;
  path?: unknown;
  userAgent?: unknown;
};

export type ClientErrorRecord = {
  kind: "client";
  at: string;
  source: "boundary" | "window" | "promise";
  digest?: string;
  name: string;
  message: string;
  stack?: string[];
  path: string;
  userAgent?: string;
  userId?: string;
  companyId?: string;
  version: string;
  build: string;
};

const SOURCES = new Set(["boundary", "window", "promise"]);

/**
 * The record for an error a browser reports. Everything in the input is
 * untrusted: unknown fields are dropped, every string is clamped and redacted.
 */
export function clientErrorRecord(
  input: ClientErrorInput,
  who: { userId?: string | null; companyId?: string | null },
  build: BuildInfo,
  now: Date = new Date(),
): ClientErrorRecord | null {
  if (!input || typeof input !== "object") return null;
  const message = clampMessage(input.message);
  if (!message) return null;
  const source = typeof input.source === "string" && SOURCES.has(input.source)
    ? (input.source as ClientErrorRecord["source"])
    : "window";
  const digest =
    typeof input.digest === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(input.digest)
      ? input.digest
      : undefined;
  return {
    kind: "client",
    at: now.toISOString(),
    source,
    digest,
    name: typeof input.name === "string" ? input.name.slice(0, 80) : "Error",
    message,
    stack: clampStack(typeof input.stack === "string" ? input.stack.slice(0, 8000) : undefined),
    path: redactPath(typeof input.path === "string" ? input.path : "/"),
    userAgent: typeof input.userAgent === "string" ? input.userAgent.slice(0, 200) : undefined,
    userId: who.userId ?? undefined,
    companyId: who.companyId ?? undefined,
    version: build.version,
    build: build.build,
  };
}

/** One line, greppable by tag and by digest. */
export function formatLogLine(record: ServerErrorRecord | ClientErrorRecord): string {
  return `${ERROR_LOG_TAG} ${JSON.stringify(record)}`;
}

/**
 * The text the Report button puts into a bug report, so the founder's bug list
 * links straight to the log line.
 */
export function bugReportPrefill(input: {
  message: string;
  digest?: string;
  path: string;
  version: string;
}): { title: string; description: string } {
  const msg = clampMessage(input.message).replace(/\s+/g, " ").trim();
  const title = `Error: ${msg || "something went wrong"}`.slice(0, 120);
  const lines = [
    "What I was doing when it happened:",
    "",
    "",
    "---",
    `Page: ${redactPath(input.path)}`,
    input.digest ? `Ref: ${input.digest}` : null,
    `Version: ${input.version}`,
  ].filter((l): l is string => l !== null);
  return { title, description: lines.join("\n") };
}
