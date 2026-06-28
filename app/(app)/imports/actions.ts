"use server";

import { revalidatePath } from "next/cache";
import { parseCsv } from "@/lib/csv";
import { createClient } from "@/lib/data/clients";
import { CLIENT_TYPE_LABEL, type ClientType, type ClientStatus, type ClientWriteInput } from "@/lib/data/clients.types";

export type ImportResult = {
  total: number;
  created: number;
  failures: { row: number; name: string; error: string }[];
};

const TYPES = Object.keys(CLIENT_TYPE_LABEL) as ClientType[];
const STATUSES: ClientStatus[] = ["ACTIVE", "INACTIVE", "PROSPECT"];

const pick = (row: Record<string, string>, ...keys: string[]): string => {
  for (const k of keys) {
    const hit = Object.keys(row).find((rk) => rk.toLowerCase() === k.toLowerCase());
    if (hit && row[hit]?.trim()) return row[hit].trim();
  }
  return "";
};

function toClientInput(row: Record<string, string>): ClientWriteInput | { error: string } {
  const name = pick(row, "name", "client", "client name");
  if (!name) return { error: "Missing required column: name" };

  const rawType = pick(row, "type").toUpperCase().replace(/\s+/g, "_");
  const type: ClientType = (TYPES as string[]).includes(rawType) ? (rawType as ClientType) : "PRIVATE";

  const rawStatus = pick(row, "status").toUpperCase();
  const status: ClientStatus = (STATUSES as string[]).includes(rawStatus) ? (rawStatus as ClientStatus) : "ACTIVE";

  const tags = pick(row, "tags").split(/[;|]/).map((t) => t.trim()).filter(Boolean);

  return {
    name,
    companyName: pick(row, "companyName", "company", "legal name") || null,
    contactPerson: pick(row, "contactPerson", "contact", "contact person") || null,
    email: pick(row, "email") || null,
    phone: pick(row, "phone", "tel") || null,
    website: pick(row, "website", "url") || null,
    taxNumber: pick(row, "taxNumber", "trn", "tax") || null,
    type,
    status,
    tags,
    notes: pick(row, "notes") || null,
    addresses: [],
  };
}

export async function importClientsAction(csvText: string): Promise<ImportResult> {
  const rows = parseCsv(csvText);
  const failures: ImportResult["failures"] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const mapped = toClientInput(rows[i]);
    if ("error" in mapped) {
      failures.push({ row: i + 2, name: pick(rows[i], "name") || "—", error: mapped.error });
      continue;
    }
    try {
      await createClient(mapped);
      created++;
    } catch (e) {
      failures.push({ row: i + 2, name: mapped.name, error: e instanceof Error ? e.message : "Create failed" });
    }
  }

  if (created > 0) revalidatePath("/clients");
  return { total: rows.length, created, failures };
}
