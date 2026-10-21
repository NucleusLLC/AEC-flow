import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseAppointmentInput,
  parseCancelInput,
  parseCompleteInput,
  parsePostponeInput,
} from "./schema";
import { APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from "./types";

const base = {
  type: "INSPECTION",
  title: "Foundation inspection",
  date: "2026-10-20",
  startTime: "09:00",
  endTime: "11:30",
  projectId: "proj_1",
};

describe("booking an appointment", () => {
  it("accepts a visit linked to a project", () => {
    const r = parseAppointmentInput({ ...base, location: "  ", attendeeIds: ["u1", "u1", "u2"] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.location).toBeNull();
    expect(r.value.serviceProposalId).toBeNull();
    expect(r.value.attendeeIds).toEqual(["u1", "u2"]);
  });

  it("accepts a visit linked only to a service proposal", () => {
    const r = parseAppointmentInput({ ...base, projectId: null, serviceProposalId: "sp_1" });
    expect(r.ok).toBe(true);
  });

  it("refuses a visit linked to nothing", () => {
    const r = parseAppointmentInput({ ...base, projectId: "", serviceProposalId: "" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues[0].message).toMatch(/project or a service proposal/);
  });

  it("refuses an end at or before the start", () => {
    for (const endTime of ["09:00", "08:30"]) {
      const r = parseAppointmentInput({ ...base, endTime });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.issues[0].path).toBe("endTime");
    }
  });

  it("refuses unknown types, bad dates and bad times", () => {
    expect(parseAppointmentInput({ ...base, type: "PARTY" }).ok).toBe(false);
    expect(parseAppointmentInput({ ...base, date: "2026-02-30" }).ok).toBe(false);
    expect(parseAppointmentInput({ ...base, startTime: "9am" }).ok).toBe(false);
    expect(parseAppointmentInput({ ...base, endTime: "25:00" }).ok).toBe(false);
  });

  it("holds every text to a length", () => {
    expect(parseAppointmentInput({ ...base, title: "" }).ok).toBe(false);
    expect(parseAppointmentInput({ ...base, title: "x".repeat(201) }).ok).toBe(false);
    expect(parseAppointmentInput({ ...base, notes: "x".repeat(4001) }).ok).toBe(false);
    expect(parseAppointmentInput({ ...base, attendeeIds: Array.from({ length: 51 }, (_, i) => `u${i}`) }).ok).toBe(false);
  });

  it("does not carry names from the caller", () => {
    const r = parseAppointmentInput({ ...base, projectName: "Somebody else's job", attendeeNames: ["X"] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect("projectName" in r.value).toBe(false);
      expect("attendeeNames" in r.value).toBe(false);
    }
  });
});

describe("completing, cancelling and postponing", () => {
  it("takes the actual hours as a number or a typed figure", () => {
    const r = parseCompleteInput({ actualHours: "2.5", outcome: "Rebar as drawn", logToTimesheet: true });
    expect(r).toEqual({ ok: true, value: { actualHours: 2.5, outcome: "Rebar as drawn", logToTimesheet: true } });
    const d = parseCompleteInput({ actualHours: 1 });
    expect(d.ok && d.value.logToTimesheet).toBe(false);
  });

  it("refuses zero, negative, absurd or missing hours", () => {
    for (const actualHours of [0, -1, 25, "abc", undefined]) {
      expect(parseCompleteInput({ actualHours }).ok).toBe(false);
    }
  });

  it("needs a reason to cancel", () => {
    expect(parseCancelInput({ reason: "  " }).ok).toBe(false);
    expect(parseCancelInput({ reason: "Client away" }).ok).toBe(true);
  });

  it("needs a new date and times to postpone", () => {
    expect(parsePostponeInput({ date: "2026-10-27", startTime: "10:00", endTime: "11:00" }).ok).toBe(true);
    expect(parsePostponeInput({ date: "2026-10-27", startTime: "10:00", endTime: "09:00" }).ok).toBe(false);
    expect(parsePostponeInput({ startTime: "10:00", endTime: "11:00" }).ok).toBe(false);
  });
});

describe("the unions match the schema's enums", () => {
  const schema = readFileSync(resolve(__dirname, "../../prisma/schema.prisma"), "utf8");
  const enumValues = (name: string) => {
    const m = new RegExp(`enum ${name} \\{([\\s\\S]*?)\\}`).exec(schema);
    if (!m) throw new Error(`enum ${name} not found`);
    return m[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//"));
  };

  it("AppointmentType", () => expect(enumValues("AppointmentType")).toEqual(APPOINTMENT_TYPES));
  it("AppointmentStatus", () => expect(enumValues("AppointmentStatus")).toEqual(APPOINTMENT_STATUSES));
  it("the 0035 SQL creates the same values", () => {
    const sql = readFileSync(resolve(__dirname, "../../prisma/sql/0035_appointments.sql"), "utf8");
    const values = (name: string) =>
      new RegExp(`CREATE TYPE "${name}" AS ENUM \\(([^)]*)\\)`)
        .exec(sql)![1]
        .split(",")
        .map((s) => s.trim().replace(/'/g, ""));
    expect(values("AppointmentType")).toEqual(APPOINTMENT_TYPES);
    expect(values("AppointmentStatus")).toEqual(APPOINTMENT_STATUSES);
  });
});
