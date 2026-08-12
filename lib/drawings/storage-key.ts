/**
 * Storage object keys for drawing files. Pure, so it can be tested without a
 * database, a bucket, or a request.
 *
 * THE KEY IS CHOSEN BY THE SERVER, NEVER BY THE CLIENT. A signed upload URL is
 * a capability to write one object; if the browser named the object, it could
 * name one belonging to another project. Keeping the shape here — rather than
 * inline in the repository — is also what lets the repository verify a key it
 * is handed back really looks like one it issued.
 */

/**
 * Make a filename safe as the last path segment: no separators, no control
 * characters, nothing that needs escaping. The user's original filename is kept
 * verbatim on the register row, so mangling here loses nothing a person sees.
 */
export function sanitiseFilename(name: string): string {
  const trimmed = String(name ?? "").trim();
  const dot = trimmed.lastIndexOf(".");
  const stem = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  const ext = dot > 0 ? trimmed.slice(dot + 1).toLowerCase() : "";

  const safeStem =
    stem
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 100) || "drawing";
  const safeExt = ext.replace(/[^A-Za-z0-9]/g, "").slice(0, 10);
  return safeExt ? `${safeStem}.${safeExt}` : safeStem;
}

/** The prefix every one of a project's drawing objects lives under. */
export function projectDrawingPrefix(projectId: string): string {
  return `projects/${projectId}/drawings/`;
}

/**
 * `projects/<projectId>/drawings/<uploadId>/<filename>`.
 *
 * Project-scoped so a storage policy can be expressed as a prefix match, and
 * upload-scoped so nothing ever overwrites anything. Superseding a revision
 * must not destroy the file that was issued: "what exactly did we send on the
 * 4th?" is a question asked after a dispute, not before one.
 *
 * The feasibility doc proposed keying on drawing id and revision. The row does
 * not exist when the URL is minted, so an opaque upload id stands in; the row
 * records the key it was given.
 */
export function buildStorageKey(projectId: string, filename: string, uploadId: string): string {
  return `${projectDrawingPrefix(projectId)}${uploadId}/${sanitiseFilename(filename)}`;
}

/** True when `key` is one this module would have issued for `projectId`. */
export function isKeyForProject(key: string, projectId: string): boolean {
  const prefix = projectDrawingPrefix(projectId);
  return (
    typeof key === "string" &&
    key.startsWith(prefix) &&
    // exactly `<uploadId>/<filename>` after the prefix — no traversal, no
    // deeper nesting that a policy written as a prefix match would not expect
    /^[A-Za-z0-9-]+\/[^/]+$/.test(key.slice(prefix.length))
  );
}
