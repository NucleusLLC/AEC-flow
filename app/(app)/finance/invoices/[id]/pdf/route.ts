/**
 * The invoice as a PDF file, generated on the server (lib/finance/invoice-pdf.ts)
 * — the same file the "Email invoice" button attaches. Opens in the browser;
 * `?download=1` saves it instead.
 *
 * Tenant-scoped through lib/data/invoices.ts, which reads the company off the
 * session — with no session there is no scope, so it refuses outright.
 */
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServerT } from "@/lib/i18n/server";
import { renderInvoicePdf } from "@/lib/server/invoice-email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const t = await getServerT();
  if (!session?.user?.companyId) {
    return new NextResponse(t("Sign in to open this invoice."), { status: 401 });
  }
  const { id } = await params;
  const pdf = await renderInvoicePdf(id);
  if (!pdf) return new NextResponse(t("That invoice could not be found."), { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new NextResponse(Buffer.from(pdf.bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${pdf.filename}"`,
      "cache-control": "no-store",
    },
  });
}
