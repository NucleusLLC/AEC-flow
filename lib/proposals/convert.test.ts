import { describe, expect, it } from "vitest";
import {
  STANDARD_PROJECT_PHASES,
  convertBlocker,
  projectContractValue,
  projectDisciplines,
  projectPhaseNames,
} from "./convert";

describe("convertBlocker", () => {
  it("allows an accepted proposal with a client record and no project", () => {
    expect(convertBlocker({ status: "ACCEPTED", clientId: "c1", projectId: null })).toBeNull();
    expect(convertBlocker({ status: "PARTIALLY_ACCEPTED", clientId: "c1", projectId: null })).toBeNull();
  });

  it("refuses anything not accepted", () => {
    for (const status of ["DRAFT", "SENT", "REJECTED", "CONVERTED"] as const) {
      expect(convertBlocker({ status, clientId: "c1", projectId: null })).toBe("status");
    }
  });

  it("refuses a client named in text only", () => {
    expect(convertBlocker({ status: "ACCEPTED", clientId: null, projectId: null })).toBe("client");
  });

  it("reports a proposal that already has a project, before the client check", () => {
    expect(convertBlocker({ status: "ACCEPTED", clientId: null, projectId: "p1" })).toBe("alreadyLinked");
  });
});

describe("projectDisciplines", () => {
  it("maps free-text keys and labels onto the project list, once each, in list order", () => {
    expect(
      projectDisciplines([
        { disciplineKey: "mep", label: "MEP engineering" },
        { disciplineKey: "arch", label: "Architecture" },
        { disciplineKey: null, label: "Arquitectura de interiores" },
        { disciplineKey: "structural", label: "Structural engineering" },
        { disciplineKey: "architecture-2", label: "Architect site visits" },
      ]),
    ).toEqual(["ARCHITECTURE", "STRUCTURAL", "INTERIOR", "MEP"]);
  });

  it("matches interior design when it is the only word", () => {
    expect(projectDisciplines([{ label: "Interior design" }])).toEqual(["INTERIOR"]);
  });

  it("leaves out what it cannot place", () => {
    expect(projectDisciplines([{ label: "Landscape" }, { label: "" }])).toEqual([]);
  });
});

describe("projectPhaseNames", () => {
  it("keeps the proposal's phases in their order", () => {
    expect(
      projectPhaseNames([
        { name: "Design development", sortOrder: 2 },
        { name: "Concept", sortOrder: 1 },
        { name: "  ", sortOrder: 3 },
        { name: "Permit", sortOrder: 4 },
      ]),
    ).toEqual(["Concept", "Design development", "Permit"]);
  });

  it("falls back to the standard six when the proposal has none", () => {
    expect(projectPhaseNames([])).toEqual([...STANDARD_PROJECT_PHASES]);
  });
});

describe("projectContractValue", () => {
  it("is the grand total less tax, to the cent", () => {
    expect(projectContractValue({ currency: "AWG", grandTotal: "535.00", taxTotal: "35.00" })).toBe(500);
    expect(projectContractValue({ currency: "AWG", grandTotal: 1070.1, taxTotal: 70.01 })).toBe(1000.09);
  });

  it("is the grand total when there is no tax, and never negative", () => {
    expect(projectContractValue({ currency: "USD", grandTotal: 1200, taxTotal: null })).toBe(1200);
    expect(projectContractValue({ currency: "USD", grandTotal: 0, taxTotal: 5 })).toBe(0);
  });
});
