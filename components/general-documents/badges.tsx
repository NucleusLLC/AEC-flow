import { Badge } from "@/components/ui/badge";
import {
  DOCUMENT_CATEGORY_LABEL,
  GENERAL_DOCUMENT_STATUS_LABEL,
  GENERAL_DOCUMENT_STATUS_TONE,
  type DocumentCategory,
  type GeneralDocumentStatus,
} from "@/lib/general-documents/types";

/**
 * The module's whole colour vocabulary, wrapping the app's existing <Badge>.
 * A new colour system for one module is how two screens in the same product
 * come to disagree about what amber means.
 */
export function DocumentStatusBadge({ status }: { status: GeneralDocumentStatus }) {
  return (
    <Badge tone={GENERAL_DOCUMENT_STATUS_TONE[status]}>
      {GENERAL_DOCUMENT_STATUS_LABEL[status]}
    </Badge>
  );
}

export function DocumentCategoryBadge({ category }: { category: DocumentCategory | null }) {
  if (!category) return null;
  return <Badge tone="neutral">{DOCUMENT_CATEGORY_LABEL[category]}</Badge>;
}
