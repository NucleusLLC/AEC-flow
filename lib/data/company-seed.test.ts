/**
 * The signup seed, under the condition that broke it.
 *
 * At signup there is a request but no session, so the tenant extension in
 * lib/db.ts scopes every READ of a company-owned model to `companyId: null`:
 * `findMany` returns nothing and `count` returns 0, whatever was just written.
 * The fake client below behaves exactly like that. The seed used to create its
 * clients and read them back; under this client that read is empty, and the
 * old code went on to create no project, no schedule, no estimate and no
 * proposal, without an error. These tests fail on that code.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const created: Record<string, Row[]> = {};
let failOn: string | null = null;
let seq = 0;

function model(name: string) {
  return {
    // What the tenant scope answers at signup: nothing.
    findMany: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    create: vi.fn(async ({ data }: { data: Row }) => {
      if (failOn === name) throw new Error(`\nInvalid invocation\n\nThe column \`${name}.missing\` does not exist in the current database.`);
      const row = { id: `${name}-${++seq}`, ...data };
      (created[name] ??= []).push(row);
      return row;
    }),
    createMany: vi.fn(async ({ data }: { data: Row[] }) => {
      if (failOn === name) throw new Error("createMany failed");
      (created[name] ??= []).push(...data);
      return { count: data.length };
    }),
  };
}

const fake = {
  // Not a tenant model: never scoped, so the owner is found.
  user: { findFirst: vi.fn(async () => ({ id: "user-1", name: "Owner" }) as { id: string; name: string } | null) },
  client: model("client"),
  project: model("project"),
  projectSchedule: model("projectSchedule"),
  costEstimate: model("costEstimate"),
  proposal: model("proposal"),
  task: model("task"),
};

// A getter, because vi.mock is hoisted above `fake`: it is read when the seed runs.
vi.mock("@/lib/db", () => ({
  get prisma() {
    return fake;
  },
}));

import { seedCompany } from "./company-seed";

const COMPANY = "cmpany0000000000000abcde";

beforeEach(() => {
  for (const k of Object.keys(created)) delete created[k];
  failOn = null;
  seq = 0;
  fake.user.findFirst.mockResolvedValue({ id: "user-1", name: "Owner" });
});

describe("seedCompany at signup (reads scoped to nothing)", () => {
  it("creates the whole seed: clients, two projects, a schedule, an estimate, two proposals and tasks", async () => {
    const report = await seedCompany(COMPANY);
    expect(report).toEqual({ clients: 3, projects: 2, schedules: 1, estimates: 1, proposals: 2, tasks: 4, failures: [] });
    expect(created.project).toHaveLength(2);
    expect(created.projectSchedule).toHaveLength(1);
    expect(created.costEstimate).toHaveLength(1);
    expect(created.proposal).toHaveLength(2);
  });

  it("files the projects and proposals under the clients it created, not under a re-read", async () => {
    await seedCompany(COMPANY);
    const clientIds = created.client.map((c) => c.id);
    expect(clientIds).toHaveLength(3);
    for (const p of created.project) expect(clientIds).toContain(p.clientId);
    for (const p of created.proposal) expect(clientIds).toContain(p.clientId);
    expect(created.project[0].managerId).toBe("user-1");
  });

  it("puts the company on every row it writes", async () => {
    await seedCompany(COMPANY);
    for (const name of ["client", "project", "projectSchedule", "costEstimate", "proposal", "task"]) {
      for (const row of created[name]) expect({ name, companyId: row.companyId }).toEqual({ name, companyId: COMPANY });
    }
  });

  it("keys the estimate and the schedule by their project", async () => {
    await seedCompany(COMPANY);
    const project = created.project[0];
    expect(created.costEstimate[0].id).toBe(project.id);
    expect(created.costEstimate[0].projectId).toBe(project.id);
    expect(created.projectSchedule[0].projectId).toBe(project.id);
  });

  it("one failing entity does not drop the ones after it, and says so in the log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    failOn = "projectSchedule";
    const report = await seedCompany(COMPANY);
    expect(report.failures).toEqual(["schedule"]);
    expect(report).toMatchObject({ clients: 3, projects: 2, schedules: 0, estimates: 1, proposals: 2, tasks: 4 });
    const line = String(log.mock.calls[0]?.[0] ?? "");
    expect(line.startsWith("[aecflow-error] ")).toBe(true);
    const record = JSON.parse(line.slice("[aecflow-error] ".length));
    expect(record).toMatchObject({ kind: "server", name: "CompanySeed", step: "schedule", companyId: COMPANY });
    expect(record.message).toContain("does not exist in the current database");
    log.mockRestore();
  });

  it("a failure on the clients still seeds the tasks, never throws, and is logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    failOn = "client";
    const report = await seedCompany(COMPANY);
    expect(report.failures).toEqual(["clients"]);
    expect(report.tasks).toBe(4);
    expect(report.projects).toBe(0);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("a company with no user is reported, not silently skipped", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fake.user.findFirst.mockResolvedValue(null);
    const report = await seedCompany(COMPANY);
    expect(report.failures).toContain("owner");
    expect(report.projects).toBe(0);
    expect(report.clients).toBe(3);
    expect(String(log.mock.calls[0]?.[0])).toContain("CompanySeed");
    log.mockRestore();
  });
});
