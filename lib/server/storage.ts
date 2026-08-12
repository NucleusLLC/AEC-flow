/**
 * Supabase Storage — the private object store behind drawing intake.
 *
 * SERVER-ONLY. It holds the service-role key, which bypasses every RLS policy.
 * Importing this into a client component would ship that key to the browser, so
 * nothing here may ever be re-exported through a `"use client"` module.
 *
 * WHY PLAIN `fetch` AND NOT `@supabase/supabase-js`. Three endpoints are used —
 * sign an upload, sign a download, delete — and each is one HTTP call. The SDK
 * would add a dependency (and its auth/realtime/postgrest surface) to every
 * serverless bundle that touches a drawing, to save about forty lines. The REST
 * shapes used here are the same ones the SDK calls, and the round trip was
 * verified against the live project before this file was written.
 *
 * THE SECURITY MODEL, in one paragraph. The bucket is PRIVATE and has no
 * anonymous policy at all. The browser never receives the service key: it asks
 * the server for a short-lived signed URL, uploads the bytes straight to
 * storage with it, then asks the server to record the row. Reads work the same
 * way in reverse — a signed download URL minted per request, never stored. A
 * public bucket URL is forever, and drawings are client-confidential.
 *
 * NOT CONFIGURED IS A VALID STATE. Every function checks first and returns a
 * typed failure rather than throwing on a missing env var, mirroring
 * lib/server/email.ts. A developer without the keys gets a truthful "storage is
 * not connected" in the UI instead of a stack trace.
 */

import "server-only";

const DEFAULT_BUCKET = "drawings";

/**
 * Per-file ceiling. Capped by the Supabase PROJECT-wide limit, which is
 * 52428800 (50 MiB) on this project's plan — raising this number alone does not
 * raise that one, it only moves the rejection from our check to theirs.
 */
export const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** How long an upload URL stays valid. Supabase fixes this at two hours. */
export const UPLOAD_URL_TTL_SECONDS = 2 * 60 * 60;

/** How long a download URL stays valid. Short: it is minted per request. */
export const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

export type StorageConfig = {
  url: string;
  serviceKey: string;
  bucket: string;
};

export function storageConfig(): StorageConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return { url, serviceKey, bucket: process.env.SUPABASE_DRAWINGS_BUCKET || DEFAULT_BUCKET };
}

export function isStorageConfigured(): boolean {
  return storageConfig() !== null;
}

/** The server-side upload ceiling, in bytes. */
export function maxUploadBytes(): number {
  const raw = Number(process.env.DRAWINGS_MAX_UPLOAD_BYTES);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_MAX_UPLOAD_BYTES;
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      "File storage is not connected. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, " +
        "and create the private bucket named by SUPABASE_DRAWINGS_BUCKET.",
    );
    this.name = "StorageNotConfiguredError";
  }
}

export class StorageError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "StorageError";
    this.status = status;
  }
}

function requireConfig(): StorageConfig {
  const config = storageConfig();
  if (!config) throw new StorageNotConfiguredError();
  return config;
}

function authHeaders(config: StorageConfig): Record<string, string> {
  return {
    authorization: `Bearer ${config.serviceKey}`,
    apikey: config.serviceKey,
  };
}

/** Percent-encode each path segment, keeping the `/` separators intact. */
function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

async function failure(response: Response, action: string): Promise<never> {
  let detail = "";
  try {
    detail = (await response.text()).slice(0, 300);
  } catch {
    /* body already consumed or empty — the status is the signal */
  }
  throw new StorageError(`${action} failed (${response.status}). ${detail}`.trim(), response.status);
}

export type SignedUpload = {
  /** Absolute URL. PUT the bytes here — the token is in the query string, so
   *  this request carries no credentials of its own. */
  uploadUrl: string;
  storageKey: string;
  expiresAt: string;
};

/**
 * Mint a signed upload URL for `key`.
 *
 * The returned URL is a capability: anyone holding it can write that ONE object
 * until it expires. That is the point — it is what keeps a 60 MB drawing from
 * having to travel through a serverless function's request body — but it means
 * the key must be decided server-side (it is; see the intake repository) and
 * never accepted from the client.
 */
export async function createSignedUpload(key: string): Promise<SignedUpload> {
  const config = requireConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/upload/sign/${config.bucket}/${encodeKey(key)}`,
    {
      method: "POST",
      headers: { ...authHeaders(config), "content-type": "application/json" },
      body: "{}",
      cache: "no-store",
    },
  );
  if (!response.ok) await failure(response, "Signing the upload");

  const body = (await response.json()) as { url?: string };
  if (!body.url) throw new StorageError("Storage returned no upload URL.", 502);

  return {
    uploadUrl: `${config.url}/storage/v1${body.url}`,
    storageKey: key,
    expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
  };
}

/** Mint a short-lived signed download URL. Never store the result on a row. */
export async function createSignedDownload(
  key: string,
  expiresIn = DOWNLOAD_URL_TTL_SECONDS,
): Promise<string> {
  const config = requireConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/sign/${config.bucket}/${encodeKey(key)}`,
    {
      method: "POST",
      headers: { ...authHeaders(config), "content-type": "application/json" },
      body: JSON.stringify({ expiresIn }),
      cache: "no-store",
    },
  );
  if (!response.ok) await failure(response, "Signing the download");

  const body = (await response.json()) as { signedURL?: string };
  if (!body.signedURL) throw new StorageError("Storage returned no download URL.", 502);
  return `${config.url}/storage/v1${body.signedURL}`;
}

/** Metadata for an object, or null when it does not exist. */
export async function statObject(
  key: string,
): Promise<{ sizeBytes: number; mimeType: string } | null> {
  const config = requireConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/info/authenticated/${config.bucket}/${encodeKey(key)}`,
    { headers: authHeaders(config), cache: "no-store" },
  );
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) await failure(response, "Reading object info");

  const body = (await response.json()) as { size?: number; contentType?: string; mimetype?: string };
  return {
    sizeBytes: Number(body.size ?? 0),
    mimeType: body.contentType ?? body.mimetype ?? "application/octet-stream",
  };
}

/** Delete one object. Used to clean up after a failed registration. */
export async function deleteObject(key: string): Promise<void> {
  const config = requireConfig();
  const response = await fetch(`${config.url}/storage/v1/object/${config.bucket}`, {
    method: "DELETE",
    headers: { ...authHeaders(config), "content-type": "application/json" },
    body: JSON.stringify({ prefixes: [key] }),
    cache: "no-store",
  });
  if (!response.ok) await failure(response, "Deleting the object");
}
