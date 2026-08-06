/**
 * Drawing metadata extraction — public entry point.
 *
 * ```ts
 * import { extractDrawingMetadata } from "@/lib/drawings";
 *
 * // Client: filename only. No dependency, no bytes transferred, instant.
 * const draft = extractDrawingMetadata({ filename: "ZA-2026-121-A-101_Rev-B.pdf" });
 *
 * // Server: same call with title-block text from a PDF reader.
 * const draft = extractDrawingMetadata({ filename, titleBlockText });
 * ```
 *
 * Everything reachable from here is pure except `./pdf-text`, which is imported
 * for its types only and must be constructed at a server entry point.
 */

export {
  bandOf,
  CONFIDENCE_HIGH,
  CONFIDENCE_MEDIUM,
  DRAFT_FIELD_KEYS,
  EMPTY_DRAFT,
  field,
  type Alternate,
  type ConfidenceBand,
  type DraftFieldKey,
  type DrawingMetadataDraft,
  type Evidence,
  type EvidenceSource,
  type Field,
  type SheetDiscipline,
} from "./types";

export { extractFromFilename, splitExtension } from "./filename";
export { extractFromTitleBlockText } from "./titleblock";
export { mergeDrafts, mergeField } from "./merge";
export {
  DISCIPLINE_PREFIXES,
  SHEET_DISCIPLINE_LABEL,
  isRealDate,
  scanDates,
  scanProjectNumbers,
  scanRevisions,
  scanSheetNumbers,
} from "./primitives";
export {
  DEFAULT_REGION_OPTIONS,
  layoutToText,
  selectTitleBlockText,
  type PdfPageText,
  type PdfTextItem,
  type RegionOptions,
  type RegionResult,
} from "./region";
export {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_BYTES,
  MAX_FILENAME_LENGTH,
  MAX_FILES_PER_BATCH,
  MIN_FILE_BYTES,
  formatBytes,
  validateBatch,
  validateUpload,
  type DrawingFileKind,
  type UploadCandidate,
  type UploadRejectionCode,
  type UploadVerdict,
} from "./upload-policy";
export { LOSSY_DISCIPLINES, toDataDiscipline } from "./mapping";
export {
  DrawingPersistenceNotConfiguredError,
  EXTRACTION_ENGINE_VERSION,
  notConfiguredRepository,
  type ConfirmedDrawingMetadata,
  type DrawingExtractionAudit,
  type DrawingIntakeRepository,
  type ExistingSheet,
  type RegisterDrawingInput,
  type StoredFileRef,
  type UploadTicket,
} from "./persistence";
export {
  createStubReader,
  createUnpdfReader,
  PdfTextUnavailableError,
  TEXT_LAYER_CHAR_THRESHOLD,
  unavailablePdfTextReader,
  type PdfDocumentText,
  type PdfReadOptions,
  type PdfTextReader,
  type PdfTextSourceModule,
} from "./pdf-text";

import { extractFromFilename } from "./filename";
import { mergeDrafts } from "./merge";
import { extractFromTitleBlockText } from "./titleblock";
import type { DrawingMetadataDraft } from "./types";

export type ExtractionInput = {
  /** Required. The only signal available for DWG and RVT. */
  filename: string;
  /**
   * Title-block text, already extracted. Omit when there is none — passing
   * `""` for a scanned PDF is indistinguishable from passing nothing, which is
   * why `pdfHadTextLayer` exists separately.
   */
  titleBlockText?: string;
  /**
   * Set to `false` when a PDF was opened and found to have no text layer. It
   * turns "we found nothing" into an explicit warning about a scan needing OCR,
   * rather than a silently thin result.
   */
  pdfHadTextLayer?: boolean;
};

/**
 * Extract from every available signal and merge. Never throws.
 */
export function extractDrawingMetadata(input: ExtractionInput): DrawingMetadataDraft {
  const fromName = extractFromFilename(input?.filename ?? "");
  const text = input?.titleBlockText?.trim();
  const fromText = text ? extractFromTitleBlockText(text) : null;
  const merged = mergeDrafts(fromName, fromText);

  if (input?.pdfHadTextLayer === false) {
    merged.warnings.unshift(
      "This PDF has no text layer — it is a scan or a plot with outlined text. " +
        "Only the filename could be read; everything else needs OCR, which is not available.",
    );
  }
  return merged;
}
