"use client";

/**
 * The browser-side `DrawingIntakeRepository`: a thin adapter that satisfies the
 * interface in `lib/drawings/persistence.ts` by calling server actions.
 *
 * It exists so the intake component keeps depending on ONE interface rather
 * than on Next.js server actions. That is what let the component be built and
 * tested before any of this existed, and it is what would let the same
 * component run against a different backend later.
 *
 * Errors: the actions return `{ ok: false, error }` instead of throwing, so
 * this layer converts a refusal back into a thrown `Error`. The interface
 * promises rejection, and the component's catch already renders the message.
 */

import {
  createUploadTicketAction,
  findSheetsAction,
  registerDrawingAction,
} from "@/app/(app)/drawings/actions";
import type {
  DrawingIntakeRepository,
  ExistingSheet,
  RegisterDrawingInput,
  UploadTicket,
} from "@/lib/drawings/persistence";
import type { FileType } from "@/lib/data/drawings.types";

export const serverIntakeRepository: DrawingIntakeRepository = {
  async createUploadTicket(input): Promise<UploadTicket> {
    const result = await createUploadTicketAction(input);
    if (!result.ok) throw new Error(result.error);
    return result.ticket;
  },

  async registerDrawing(input: RegisterDrawingInput): Promise<{ id: string }> {
    const result = await registerDrawingAction({
      projectId: input.projectId,
      storageKey: input.file.storageKey,
      filename: input.file.filename,
      mimeType: input.file.mimeType,
      fileType: input.file.fileType as FileType,
      metadata: input.metadata,
      audit: input.audit,
      sheetDiscipline: input.metadata.sheetDiscipline ?? null,
      supersedes: input.supersedes,
    });
    if (!result.ok) throw new Error(result.error);
    return { id: result.id };
  },

  async findSheets(projectId: string, sheetNumber: string): Promise<ExistingSheet[]> {
    const result = await findSheetsAction(projectId, sheetNumber);
    if (!result.ok) throw new Error(result.error);
    return result.sheets;
  },
};
