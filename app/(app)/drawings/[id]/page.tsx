import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DrawingStudio } from "@/components/drawings/studio/drawing-studio";
import { getDrawing } from "@/lib/data/drawings";
import { listComments, listMarkups } from "@/lib/data/drawing-studio";
import { getTeam } from "@/lib/data/team";
import { requireActor } from "@/lib/server/actor";

export const metadata: Metadata = { title: "Drawing · AEC-flow" };

/**
 * One sheet, open for review.
 *
 * Everything is loaded on the server and handed to the studio as its initial
 * state — the marks and the comments are already on screen when the PDF
 * finishes rendering, rather than arriving a moment later and jumping.
 */
export default async function DrawingStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const drawing = await getDrawing(id);
  if (!drawing) notFound();

  const [actor, markups, comments, team] = await Promise.all([
    requireActor(),
    listMarkups(id),
    listComments(id),
    getTeam(),
  ]);

  return (
    <DrawingStudio
      drawing={{
        id: drawing.id,
        code: drawing.code,
        title: drawing.title,
        revision: drawing.revision,
        status: drawing.status,
        projectId: drawing.projectId,
        projectNumber: drawing.projectNumber,
        projectName: drawing.projectName,
        fileType: drawing.fileType,
        paperSize: drawing.paperSize,
        paperOrientation: drawing.paperOrientation,
        sheetType: drawing.sheetType,
        pageCount: drawing.pageCount,
      }}
      initialMarkups={markups}
      initialComments={comments}
      team={team.map((t) => ({ id: t.id, name: t.name }))}
      currentUser={{ id: actor.id, name: actor.name }}
    />
  );
}
