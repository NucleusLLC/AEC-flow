/**
 * End-to-end check of the drawing-intake path against the LIVE project:
 * mint a signed upload URL, PUT bytes, register a row, read it back through
 * the register query, mint a download URL, then delete both row and object.
 *
 *   node scripts/verify-drawing-intake.mjs
 *
 * It runs OUTSIDE a request, so the Prisma tenant extension does not scope
 * anything (see lib/db.ts) — this proves the storage + database plumbing, not
 * the tenancy guards, which are enforced in the server actions.
 *
 * Everything it creates is removed before it exits, including on failure.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_DRAWINGS_BUCKET || "drawings";
if (!url || !key) {
  console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.");
  process.exit(1);
}
const H = { authorization: `Bearer ${key}`, apikey: key };

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

let storageKey = null;
let drawingId = null;

try {
  const project = await prisma.project.findFirst({ select: { id: true, projectNumber: true, companyId: true } });
  if (!project) throw new Error("No project in the database to file a test drawing against.");

  storageKey = `projects/${project.id}/drawings/${randomUUID()}/verify-A-101.pdf`;

  // 1. sign
  const signRes = await fetch(`${url}/storage/v1/object/upload/sign/${bucket}/${storageKey}`, {
    method: "POST",
    headers: { ...H, "content-type": "application/json" },
    body: "{}",
  });
  if (!signRes.ok) throw new Error(`sign failed ${signRes.status} ${await signRes.text()}`);
  const { url: signedPath } = await signRes.json();

  // 2. upload
  const bytes = Buffer.from("%PDF-1.4 verify\n");
  const putRes = await fetch(`${url}/storage/v1${signedPath}`, {
    method: "PUT",
    headers: { "content-type": "application/pdf" },
    body: bytes,
  });
  if (!putRes.ok) throw new Error(`upload failed ${putRes.status} ${await putRes.text()}`);

  // 3. the object really exists, and storage agrees about its size
  const infoRes = await fetch(`${url}/storage/v1/object/info/authenticated/${bucket}/${storageKey}`, {
    headers: H,
  });
  if (!infoRes.ok) throw new Error(`info failed ${infoRes.status}`);
  const info = await infoRes.json();
  if (Number(info.size) !== bytes.length) throw new Error(`size mismatch: ${info.size} vs ${bytes.length}`);

  // 4. register
  const row = await prisma.drawing.create({
    data: {
      companyId: project.companyId,
      projectId: project.id,
      sheetNumber: "A-101-VERIFY",
      title: "Round-trip check",
      discipline: "ARCHITECTURE",
      sheetDiscipline: "ARCHITECTURAL",
      revision: "-",
      status: "DRAFT",
      storageKey,
      filename: "verify-A-101.pdf",
      mimeType: "application/pdf",
      sizeBytes: bytes.length,
      fileType: "PDF",
      extractionAudit: { engineVersion: "1.0.0", inputs: { filename: true, titleBlockText: false }, editedFields: [] },
    },
    select: { id: true },
  });
  drawingId = row.id;

  // 5. read it back the way the register does
  const readBack = await prisma.drawing.findUnique({
    where: { id: drawingId },
    select: { sheetNumber: true, sizeBytes: true, project: { select: { projectNumber: true } } },
  });
  if (readBack?.sheetNumber !== "A-101-VERIFY") throw new Error("register read-back failed");

  // 6. the unique constraint really bites
  let duplicated = false;
  try {
    await prisma.drawing.create({
      data: {
        companyId: project.companyId,
        projectId: project.id,
        sheetNumber: "A-101-VERIFY",
        revision: "-",
        storageKey: `${storageKey}-dupe`,
        filename: "dupe.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1,
      },
      select: { id: true },
    });
    duplicated = true;
  } catch (err) {
    if (err?.code !== "P2002") throw err;
  }
  if (duplicated) throw new Error("duplicate sheet+revision was accepted — the unique index is not doing its job");

  // 7. signed download
  const dlRes = await fetch(`${url}/storage/v1/object/sign/${bucket}/${storageKey}`, {
    method: "POST",
    headers: { ...H, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: 60 }),
  });
  if (!dlRes.ok) throw new Error(`sign download failed ${dlRes.status}`);
  const { signedURL } = await dlRes.json();
  const fetched = await fetch(`${url}/storage/v1${signedURL}`);
  if (!fetched.ok) throw new Error(`download failed ${fetched.status}`);
  if ((await fetched.text()) !== bytes.toString()) throw new Error("downloaded bytes differ");

  // 8. the bucket is private: no key, no file
  const anon = await fetch(`${url}/storage/v1/object/public/${bucket}/${storageKey}`);
  if (anon.ok) throw new Error("the bucket is serving objects publicly — it must be private");

  console.log(
    [
      "sign upload      ok",
      "upload           ok",
      "object info      ok (size matches)",
      `register row     ok (${readBack.project?.projectNumber})`,
      "unique revision  ok (duplicate rejected)",
      "signed download  ok (bytes match)",
      `private bucket   ok (anonymous read ${anon.status})`,
    ].join("\n"),
  );
} catch (err) {
  console.error(`FAILED — ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  if (drawingId) await prisma.drawing.deleteMany({ where: { id: drawingId } }).catch(() => {});
  if (storageKey) {
    await fetch(`${url}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: { ...H, "content-type": "application/json" },
      body: JSON.stringify({ prefixes: [storageKey] }),
    }).catch(() => {});
  }
  await prisma.$disconnect();
}
