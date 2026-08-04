import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingDocument } from "@/components/meetings/meeting-document";
import { getMeeting } from "@/lib/data/meetings";
import { getPracticeSettings } from "@/lib/server/practice-config";
import { getFirmIdentity } from "@/lib/server/firm";
import { PrintSurface } from "@/components/print/print-surface";

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
    // The document supplies its content; PrintSurface supplies the page. Before
    // this the route drew the minutes on the component's own 820px sheet, outside
    // `.aec-doc` — so the shared table, list and break rules never reached it, the
    // configured document typeface was never applied, and there was no paged
    // preview at all: minutes running to four sheets showed on screen as one
    // continuous page with no boundaries and no page numbers.
    <PrintSurface backHref={`/meetings/${meeting.id}`} backLabel="Back to meeting">
      <MeetingDocument
        meeting={meeting}
        logo={{ dataUrl: logoDataUrl, position: logo.position, size: logo.size }}
        companyName={companyName}
        companyLocation={firm.location}
        sheet={false}
      />
    </PrintSurface>
  );
}
