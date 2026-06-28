import { Badge } from "@/components/ui/badge";
import { DRAWING_STATUS_LABEL, type DrawingStatus, type FileType } from "@/lib/data/drawings";

type Tone = "neutral" | "blue" | "green" | "amber" | "red" | "violet" | "slate";

const statusTone: Record<DrawingStatus, Tone> = {
  DRAFT: "slate",
  FOR_REVIEW: "amber",
  APPROVED: "green",
  ISSUED: "blue",
  SUPERSEDED: "red",
};

const fileColor: Record<FileType, string> = {
  PDF: "#b91c1c",
  DWG: "#1d4ed8",
  RVT: "#7c3aed",
};

export function DrawingStatusBadge({ status }: { status: DrawingStatus }) {
  return <Badge tone={statusTone[status]}>{DRAWING_STATUS_LABEL[status]}</Badge>;
}

export function FileTypeChip({ type }: { type: FileType }) {
  return (
    <span
      className="inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold text-white"
      style={{ background: fileColor[type] }}
    >
      {type}
    </span>
  );
}
