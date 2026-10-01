"use client";

import { useEffect } from "react";

/**
 * Last resort: replaces the root layout when the layout itself fails, so no
 * provider (language, session, theme) can be relied on. Plain English, inline
 * styles, its own <html>. The server logged the failure under the digest shown.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          background: "#f4f5f7",
          color: "#17202e",
          textAlign: "center",
        }}
      >
        <main style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>AEC-flow hit an unexpected error</h1>
          <p style={{ fontSize: 14, color: "#586275", margin: "0 0 12px" }}>
            Reload to try again. If it keeps happening, email hello@cad-flow.com with the reference
            below.
          </p>
          {error.digest ? (
            <p style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12, color: "#8a93a2" }}>
              ref: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 8,
              height: 36,
              padding: "0 14px",
              borderRadius: 8,
              border: 0,
              background: "#1f5fbf",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
