/**
 * Document register data-access (SERVER-ONLY — imports Prisma).
 *
 * Records documents generated from the protected systems and lists them. It
 * never reads or writes estimate/schedule tables — only the additive
 * `generated_documents` table. All calls are wrapped so the app keeps working
 * before `prisma db push` has created the table (returns empty / a soft error).
 */
import "server-only";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { MODULE_MAP, type ModuleKey } from "@/lib/modules";
import { getEstimatePrintUrl } from "@/lib/integrations/estimates/adapter";
import { getSchedulePrintUrl } from "@/lib/integrations/schedule/adapter";
import type { SourceSystem } from "./catalog";

export interface GeneratedDocDTO {
  id: string;
  sourceSystem: SourceSystem;
  docType: string;
  title: string;
  sourceRecordId: string;
  sourceRecordVersion: string | null;
  generatedInModule: string | null;
  moduleVersion: string | null;
  renderUrl: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface CreateGeneratedDocInput {
  sourceSystem: SourceSystem;
  docType: string;
  title: string;
  sourceRecordId: string;
  sourceRecordVersion?: string | null;
  /** Optional reproducibility snapshot (spec §14). */
  sourceSnapshot?: unknown;
  moduleKey?: ModuleKey;
}

function isMissingTable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  // Prisma P2021 (table does not exist) or raw Postgres 42P01.
  return /P2021|does not exist|42P01|generated_documents/i.test(msg);
}

/** Render URL for a source record — always an EXISTING print route. */
export function renderUrlFor(source: SourceSystem, recordId: string): string {
  return source === "estimates" ? getEstimatePrintUrl(recordId) : getSchedulePrintUrl(recordId);
}

export async function listGeneratedDocuments(): Promise<GeneratedDocDTO[]> {
  try {
    const rows = await prisma.generatedDocument.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map((r) => ({
      id: r.id,
      sourceSystem: r.sourceSystem as SourceSystem,
      docType: r.docType,
      title: r.title,
      sourceRecordId: r.sourceRecordId,
      sourceRecordVersion: r.sourceRecordVersion,
      generatedInModule: r.generatedInModule,
      moduleVersion: r.moduleVersion,
      renderUrl: r.renderUrl,
      createdByName: r.createdByName,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: string; needsMigration?: boolean };

export async function createGeneratedDocument(
  input: CreateGeneratedDocInput,
): Promise<CreateResult> {
  const mod = input.moduleKey ? MODULE_MAP[input.moduleKey] : undefined;
  const session = await getServerSession(authOptions);
  try {
    const row = await prisma.generatedDocument.create({
      data: {
        sourceSystem: input.sourceSystem,
        docType: input.docType,
        title: input.title,
        sourceRecordId: input.sourceRecordId,
        sourceRecordVersion: input.sourceRecordVersion ?? null,
        sourceSnapshot:
          input.sourceSnapshot === undefined
            ? undefined
            : (input.sourceSnapshot as import("@prisma/client").Prisma.InputJsonValue),
        generatedInModule: mod ? `Module ${mod.number}` : null,
        moduleVersion: mod?.version ?? null,
        renderUrl: renderUrlFor(input.sourceSystem, input.sourceRecordId),
        createdById: session?.user?.id ?? null,
        createdByName: session?.user?.name ?? null,
      },
    });
    return { ok: true, id: row.id };
  } catch (err) {
    if (isMissingTable(err)) {
      return {
        ok: false,
        needsMigration: true,
        error:
          "Document register table not created yet. Run `prisma db push` to enable saving to the register.",
      };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Failed to record document" };
  }
}
