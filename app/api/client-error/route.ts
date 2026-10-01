/**
 * Where a browser reports an error it could not handle: an error page that
 * rendered, an uncaught exception, an unhandled promise rejection. Each report
 * becomes one `[aecflow-error]` line in the function logs, next to the server
 * errors, with the signed-in user and company attached.
 *
 * Signed-in only: proxy.ts gates /api/* like every other app path, so this
 * cannot be used anonymously to fill the logs. Bodies are capped, every field
 * is clamped and redacted (lib/observability/error-record.ts), and each server
 * instance accepts a bounded number of reports per minute.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { clientErrorRecord, formatLogLine } from "@/lib/observability/error-record";
import { APP_VERSION, appBuildId } from "@/lib/version";

const MAX_BODY_BYTES = 16 * 1024;
const PER_MINUTE = 60;

let windowStart = 0;
let windowCount = 0;

function overBudget(now: number): boolean {
  if (now - windowStart > 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount += 1;
  return windowCount > PER_MINUTE;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new NextResponse(null, { status: 401 });
  if (overBudget(Date.now())) return new NextResponse(null, { status: 429 });

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const record = clientErrorRecord(
    body as Record<string, unknown>,
    { userId: session.user.id, companyId: session.user.companyId ?? null },
    { version: APP_VERSION, build: appBuildId() || "dev" },
  );
  if (!record) return new NextResponse(null, { status: 400 });

  console.error(formatLogLine(record));
  return new NextResponse(null, { status: 204 });
}
