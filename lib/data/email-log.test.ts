import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * THE RECORD.
 *
 * `@/lib/db` is mocked — the Prisma delegate is replaced with spies, so these
 * tests assert the exact arguments the data layer hands the database without
 * touching the production database it is pointed at. That mock is also what
 * makes the company-scoping assertion meaningful: if this layer were passing a
 * companyId of its own, it would show up in the recorded call.
 *
 * The scoping ITSELF is not mockable here (it lives in the Prisma client
 * extension), so it is asserted statically against lib/db.ts at the bottom of
 * this file — the same technique lib/tenant-scope-findunique.test.ts uses.
 */

const db = vi.hoisted(() => ({ create: vi.fn(), findMany: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { emailLog: { create: db.create, findMany: db.findMany } },
}));

import { recordEmailAttempt, listEmailLog } from "@/lib/data/email-log";

const ATTEMPT = {
  senderId: "usr_1",
  senderName: "Greg Laclé",
  senderEmail: "greg@aec-flow.com",
  to: "client@example.com",
  cc: ["office@zenarch.com"],
  subject: "Programme — Villa Verde",
  body: "Dear Ms Vega,",
  relatedType: "schedule",
  relatedId: "ZA-2026-014",
  documentName: "Villa Verde — Schedule.pdf",
  providerMessageId: "re_abc",
  status: "SENT" as const,
  error: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  db.create.mockResolvedValue({ id: "log_1" });
  db.findMany.mockResolvedValue([]);
});

describe("recordEmailAttempt", () => {
  it("writes every field of a successful attempt and returns the new id", async () => {
    const id = await recordEmailAttempt(ATTEMPT);
    expect(id).toBe("log_1");
    expect(db.create.mock.calls[0][0].data).toMatchObject({
      senderId: "usr_1",
      senderName: "Greg Laclé",
      senderEmail: "greg@aec-flow.com",
      to: "client@example.com",
      cc: ["office@zenarch.com"],
      subject: "Programme — Villa Verde",
      body: "Dear Ms Vega,",
      relatedType: "schedule",
      relatedId: "ZA-2026-014",
      documentName: "Villa Verde — Schedule.pdf",
      providerMessageId: "re_abc",
      status: "SENT",
      error: null,
    });
  });

  it("writes a FAILED attempt with the error text and no provider id", async () => {
    // The load-bearing case: a log of successes only is exactly how "nothing
    // went out" became invisible in the first place.
    await recordEmailAttempt({
      ...ATTEMPT,
      status: "FAILED",
      providerMessageId: null,
      error: "Email is not configured (RESEND_API_KEY missing).",
    });
    expect(db.create.mock.calls[0][0].data).toMatchObject({
      status: "FAILED",
      providerMessageId: null,
      error: "Email is not configured (RESEND_API_KEY missing).",
    });
  });

  it("never passes a companyId — the tenant extension stamps it", async () => {
    await recordEmailAttempt(ATTEMPT);
    expect(db.create.mock.calls[0][0].data).not.toHaveProperty("companyId");
  });

  it("returns null instead of throwing when the write fails", async () => {
    // A caller reaching this line already knows whether the message went out.
    // Letting a logging failure become its exception would turn a delivered
    // email into a reported error.
    db.create.mockRejectedValue(new Error("connection terminated"));
    await expect(recordEmailAttempt(ATTEMPT)).resolves.toBeNull();
  });

  it("clamps oversized text so one paste cannot bloat a row", async () => {
    await recordEmailAttempt({
      ...ATTEMPT,
      body: "x".repeat(50_000),
      subject: "s".repeat(2_000),
      to: "t".repeat(2_000),
      error: "e".repeat(10_000),
    });
    const data = db.create.mock.calls[0][0].data;
    expect(data.body.length).toBe(20_000);
    expect(data.subject.length).toBe(500);
    expect(data.to.length).toBe(500);
    expect(data.error.length).toBe(2_000);
  });

  it("normalises empty related fields to null rather than empty strings", async () => {
    await recordEmailAttempt({ ...ATTEMPT, relatedType: null, relatedId: null, documentName: null });
    expect(db.create.mock.calls[0][0].data).toMatchObject({
      relatedType: null,
      relatedId: null,
      documentName: null,
    });
  });
});

describe("listEmailLog", () => {
  it("filters to one entity when a related entity is given", async () => {
    await listEmailLog({ relatedType: "schedule", relatedId: "ZA-2026-014" });
    expect(db.findMany.mock.calls[0][0].where).toEqual({
      relatedType: "schedule",
      relatedId: "ZA-2026-014",
    });
  });

  it("returns the company's recent sends when no entity is given", async () => {
    await listEmailLog();
    expect(db.findMany.mock.calls[0][0].where).toEqual({});
    // Not a global read: the where is empty HERE because the tenant extension
    // adds companyId below this layer. See the static check further down.
  });

  it("never passes a companyId of its own", async () => {
    await listEmailLog({ relatedType: "schedule", relatedId: "x" });
    expect(JSON.stringify(db.findMany.mock.calls[0][0].where)).not.toContain("companyId");
  });

  it("shows newest first and clamps the page size", async () => {
    await listEmailLog({ limit: 5_000 });
    expect(db.findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: "desc" });
    expect(db.findMany.mock.calls[0][0].take).toBe(100);
    await listEmailLog({ limit: 0 });
    expect(db.findMany.mock.calls[1][0].take).toBe(1);
  });

  it("uses findMany, not findUnique — so the scope is a real database filter", async () => {
    // See lib/tenant-scope-findunique.test.ts: findUnique on a tenant model is
    // guarded after the fact by reading row.companyId, which a narrow select
    // silently defeats. This layer avoids the shape entirely.
    const src = readFileSync(resolve(__dirname, "email-log.ts"), "utf8");
    expect(src).not.toMatch(/\.findUnique/);
  });
});

describe("company scoping (static)", () => {
  it("registers EmailLog in TENANT_MODELS", () => {
    // Omitting it would let one practice read another's correspondence: the
    // table holds client addresses and the bodies of messages written to them.
    const src = readFileSync(resolve(__dirname, "..", "db.ts"), "utf8");
    const block = /const TENANT_MODELS = new Set<string>\(\[([\s\S]*?)\]\)/.exec(src);
    expect(block, "Could not locate TENANT_MODELS in lib/db.ts").not.toBeNull();
    const names = [...block![1].matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]);
    expect(names).toContain("EmailLog");
  });

  it("declares companyId on the model, which is what the extension filters on", () => {
    const schema = readFileSync(resolve(__dirname, "..", "..", "prisma", "schema.prisma"), "utf8");
    const model = /model\s+EmailLog\s*\{([\s\S]*?)\n\}/.exec(schema);
    expect(model, "EmailLog is missing from prisma/schema.prisma").not.toBeNull();
    expect(model![1]).toMatch(/\n\s*companyId\s+String/);
    expect(model![1]).toMatch(/@@map\("email_logs"\)/);
  });

  it("adds no foreign key or destructive statement in the migration", () => {
    // The database is production and shared. This file must only create.
    const sql = readFileSync(
      resolve(__dirname, "..", "..", "prisma", "sql", "0010_email_log.sql"),
      "utf8",
    );
    const statements = sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .toUpperCase();
    expect(statements).not.toMatch(/\bALTER\s+TABLE\b/);
    expect(statements).not.toMatch(/\bDROP\b/);
    expect(statements).not.toMatch(/\bTRUNCATE\b/);
    expect(statements).not.toMatch(/\bDELETE\b/);
    expect(statements).toMatch(/CREATE TABLE "EMAIL_LOGS"/);
  });
});
