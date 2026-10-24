/**
 * Which release is deployed: its version and its build (short commit).
 *
 * An open tab asks this every few minutes and compares the answer with the
 * release it was served (components/shell/update-notice.tsx). When they differ
 * the tab offers a reload. Nothing here is private, and nothing is read from
 * the database: it is the same label the sidebar already shows.
 *
 * Never cached, anywhere: a cached answer is exactly the stale release this
 * route exists to detect.
 */
import { NextResponse } from "next/server";
import { APP_VERSION, appBuildId } from "@/lib/version";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: APP_VERSION, build: appBuildId() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
