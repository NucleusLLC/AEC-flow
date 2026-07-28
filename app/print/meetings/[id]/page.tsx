import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PrintButton } from "@/components/meetings/print-button";
import { MeetingDocument } from "@/components/meetings/meeting-document";
import { getMeeting } from "@/lib/data/meetings";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { PageRules } from "@/components/print/page-rules";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const meeting = await getMeeting(id);
  return { title: meeting ? `${meeting.title} — Minutes` : "Meeting Minutes" };
}

export default async function MeetingPrintPage({ params }: PageProps) {
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (!meeting) notFound();
  const { logoDataUrl, logo } = await getPracticeSettings();
  const firm = await getFirmIdentity();
  const companyName = firm.name;

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Toolbar — hidden when printing */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3 print:hidden">
        <Link
          href={`/meetings/${meeting.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to meeting
        </Link>
        <PrintButton />
      </div>

      {/* A4 document sheet */}
      <div className="my-6 print:my-0">
        <MeetingDocument meeting={meeting} logo={{ dataUrl: logoDataUrl, position: logo.position, size: logo.size }} companyName={companyName} companyLocation={firm.location} />
      </div>

      <PageRules margins={{ top: 14, right: 14, bottom: 14, left: 14 }} whiteBackgroundOnPrint={false} />
    </div>
  );
}
