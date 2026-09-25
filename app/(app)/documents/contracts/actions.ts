"use server";

/**
 * Contract server actions.
 *
 * Each re-parses its payload through the zod gate before the data layer sees
 * it, and returns a discriminated result rather than throwing — the contract
 * the rest of this app keeps. Generation itself is NOT here: it streams, so it
 * lives in `app/api/contracts/generate/route.ts`.
 */

import { revalidatePath } from "next/cache";
import {
  archiveTemplate,
  createTemplateUpload,
  deleteContract,
  issueContract,
  markSigned,
  registerTemplate,
  templateFileUrl,
  updateBody,
  voidContract,
  ContractInvalidError,
  ContractLockedError,
  ContractNotFoundError,
  type TemplateDTO,
} from "@/lib/data/contracts";
import { issuesToMessage, parseContractBody, parseTemplateInput } from "@/lib/contracts/schema";
import type { ContractBody } from "@/lib/contracts/types";

export type ContractResult = { ok: true; id?: string } | { ok: false; error: string };
export type TicketResult =
  | { ok: true; uploadUrl: string; storageKey: string; headers: Record<string, string> }
  | { ok: false; error: string };
export type TemplateResult = { ok: true; template: TemplateDTO } | { ok: false; error: string };
export type UrlResult = { ok: true; url: string } | { ok: false; error: string };

const REGISTER = "/documents/contracts";

function failure(e: unknown, fallback: string): { ok: false; error: string } {
  if (
    e instanceof ContractInvalidError ||
    e instanceof ContractLockedError ||
    e instanceof ContractNotFoundError
  ) {
    return { ok: false, error: e.message };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/* ---------------- templates ---------------- */

export async function templateUploadTicketAction(input: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<TicketResult> {
  try {
    const ticket = await createTemplateUpload(input);
    return {
      ok: true,
      uploadUrl: ticket.uploadUrl,
      storageKey: ticket.storageKey,
      headers: ticket.headers,
    };
  } catch (e) {
    return failure(e, "The upload could not be started.");
  }
}

export async function registerTemplateAction(input: {
  name: string;
  description?: string | null;
  storageKey: string;
  filename: string;
}): Promise<TemplateResult> {
  const parsed = parseTemplateInput(input);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    const template = await registerTemplate(parsed.value);
    revalidatePath(REGISTER);
    return { ok: true, template };
  } catch (e) {
    return failure(e, "The template could not be saved.");
  }
}

export async function archiveTemplateAction(id: string, archived: boolean): Promise<ContractResult> {
  try {
    await archiveTemplate(id, archived);
    revalidatePath(REGISTER);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "The template could not be updated.");
  }
}

export async function templateUrlAction(id: string): Promise<UrlResult> {
  try {
    return { ok: true, url: await templateFileUrl(id) };
  } catch (e) {
    return failure(e, "That template could not be opened.");
  }
}

/* ---------------- the contract ---------------- */

export async function saveContractBodyAction(id: string, body: ContractBody): Promise<ContractResult> {
  const parsed = parseContractBody(body);
  if (!parsed.ok) return { ok: false, error: issuesToMessage(parsed.issues) };
  try {
    await updateBody(id, parsed.value as ContractBody);
    revalidatePath(`${REGISTER}/${id}`);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "The contract could not be saved.");
  }
}

export async function issueContractAction(id: string): Promise<ContractResult> {
  try {
    await issueContract(id);
    revalidatePath(REGISTER);
    revalidatePath(`${REGISTER}/${id}`);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "The contract could not be issued.");
  }
}

export async function markSignedAction(id: string, signedOn: string | null): Promise<ContractResult> {
  try {
    await markSigned(id, signedOn);
    revalidatePath(REGISTER);
    revalidatePath(`${REGISTER}/${id}`);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "The contract could not be marked as signed.");
  }
}

export async function voidContractAction(id: string, reason: string): Promise<ContractResult> {
  try {
    await voidContract(id, reason);
    revalidatePath(REGISTER);
    revalidatePath(`${REGISTER}/${id}`);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "The contract could not be voided.");
  }
}

export async function deleteContractAction(id: string): Promise<ContractResult> {
  try {
    await deleteContract(id);
    revalidatePath(REGISTER);
    return { ok: true, id };
  } catch (e) {
    return failure(e, "The contract could not be deleted.");
  }
}
