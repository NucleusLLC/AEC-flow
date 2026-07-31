import { describe, it, expect } from "vitest";
import {
  resolveProposalIdentification,
  formatClientAddress,
  primaryAddress,
} from "./identification";
import type { IdentificationSources, IdentificationRow } from "./identification";

/** Row lookup by label — the assertions care about values, not column order. */
function valueOf(rows: IdentificationRow[], label: string): string | undefined {
  return rows.find((r) => r.label === label)?.value;
}
function labels(rows: IdentificationRow[]): string[] {
  return rows.map((r) => r.label);
}

const FULL: IdentificationSources = {
  proposal: {
    clientName: "Stale Cached Client",
    projectName: "Palm Beach Residences",
    contactName: "Jane Doe",
    contactEmail: "jane@client.example",
    contactTitle: "Development Manager",
  },
  client: {
    name: "Horizon Development NV",
    companyName: "Horizon Development N.V.",
    contactPerson: "Standing Contact",
    email: "info@horizon.example",
    phone: "+297 555 1234",
    addresses: [
      { line1: "Secondary Road 1", city: "Noord", country: "Aruba", isPrimary: false },
      { line1: "L.G. Smith Blvd 120", line2: "Suite 4", city: "Oranjestad", country: "Aruba", isPrimary: true },
    ],
  },
  project: {
    name: "Palm Beach Residences (renamed)",
    projectNumber: "PRJ-2026-014",
    siteAddress: "Palm Beach 55, Noord, Aruba",
  },
};

describe("resolveProposalIdentification — sourcing precedence", () => {
  it("takes the project location from the linked project's site address", () => {
    const id = resolveProposalIdentification(FULL);
    expect(id.projectLocation).toBe("Palm Beach 55, Noord, Aruba");
    expect(valueOf(id.project, "Location")).toBe("Palm Beach 55, Noord, Aruba");
    expect(valueOf(id.project, "Project no.")).toBe("PRJ-2026-014");
  });

  it("prefers the proposal's own project name over the project's current name", () => {
    const id = resolveProposalIdentification(FULL);
    expect(id.projectDisplayName).toBe("Palm Beach Residences");
  });

  it("prefers the linked client's name over the proposal's denormalised copy", () => {
    const id = resolveProposalIdentification(FULL);
    expect(id.clientDisplayName).toBe("Horizon Development NV");
    expect(valueOf(id.client, "Client")).toBe("Horizon Development NV");
  });

  it("lets the proposal's contact person and email override the client's standing contact", () => {
    const id = resolveProposalIdentification(FULL);
    expect(valueOf(id.client, "Attention")).toBe("Jane Doe, Development Manager");
    expect(valueOf(id.client, "Email")).toBe("jane@client.example");
  });

  it("falls back to the client's contact person and email when the proposal has none", () => {
    const id = resolveProposalIdentification({
      ...FULL,
      proposal: { ...FULL.proposal, contactName: null, contactEmail: null, contactTitle: null },
    });
    expect(valueOf(id.client, "Attention")).toBe("Standing Contact");
    expect(valueOf(id.client, "Email")).toBe("info@horizon.example");
  });

  it("sources the phone from the client — the proposal holds no phone field", () => {
    const id = resolveProposalIdentification(FULL);
    expect(valueOf(id.client, "Phone")).toBe("+297 555 1234");
  });

  it("uses the primary address, not merely the first one held", () => {
    const id = resolveProposalIdentification(FULL);
    expect(valueOf(id.client, "Address")).toBe("L.G. Smith Blvd 120, Suite 4, Oranjestad, Aruba");
  });
});

describe("resolveProposalIdentification — omit-when-empty", () => {
  it("renders nothing at all for a proposal with no client and no project", () => {
    const id = resolveProposalIdentification({ proposal: {} });
    expect(id.hasAny).toBe(false);
    expect(id.project).toEqual([]);
    expect(id.client).toEqual([]);
    expect(id.clientDisplayName).toBeNull();
    expect(id.projectLocation).toBeNull();
  });

  it("emits no labelled row for a missing, blank or whitespace-only value", () => {
    const id = resolveProposalIdentification({
      proposal: { clientName: "  ", projectName: "Villa Kudawecha", contactEmail: "" },
      client: { name: "", phone: "   ", email: null, addresses: [] },
      project: { name: null, projectNumber: null, siteAddress: "" },
    });
    expect(labels(id.project)).toEqual(["Project"]);
    expect(id.client).toEqual([]);
    expect(id.hasAny).toBe(true);
    // Never a dash, an empty string or the string "undefined".
    for (const r of [...id.project, ...id.client]) {
      expect(r.value.trim()).not.toBe("");
      expect(r.value).not.toBe("—");
      expect(r.value).not.toBe("undefined");
    }
  });

  it("still renders the client block when only the proposal's denormalised name survives", () => {
    const id = resolveProposalIdentification({
      proposal: { clientName: "Walk-in Client" },
    });
    expect(labels(id.client)).toEqual(["Client"]);
    expect(id.hasAny).toBe(true);
  });

  it("omits the contact title when only a name is known", () => {
    const id = resolveProposalIdentification({
      proposal: { contactName: "Jane Doe", contactTitle: null },
    });
    expect(valueOf(id.client, "Attention")).toBe("Jane Doe");
  });

  it("suppresses the legal entity when it duplicates the client name", () => {
    const id = resolveProposalIdentification({
      proposal: {},
      client: { name: "Horizon NV", companyName: "horizon nv" },
    });
    expect(labels(id.client)).toEqual(["Client"]);
  });

  it("shows the legal entity when it genuinely differs", () => {
    const id = resolveProposalIdentification({
      proposal: {},
      client: { name: "Horizon", companyName: "Horizon Development N.V." },
    });
    expect(valueOf(id.client, "Legal entity")).toBe("Horizon Development N.V.");
  });
});

describe("formatClientAddress", () => {
  it("joins only the parts that are present", () => {
    expect(formatClientAddress({ line1: "Main St 1", city: "Oranjestad" })).toBe("Main St 1, Oranjestad");
  });

  it("returns null for an absent or wholly blank address", () => {
    expect(formatClientAddress(null)).toBeNull();
    expect(formatClientAddress({ line1: "", city: "  ", country: "" })).toBeNull();
  });

  it("de-duplicates a repeated part case-insensitively", () => {
    expect(formatClientAddress({ city: "Oranjestad", emirate: "oranjestad", country: "Aruba" }))
      .toBe("Oranjestad, Aruba");
  });
});

describe("primaryAddress", () => {
  it("returns null when there are no addresses", () => {
    expect(primaryAddress([])).toBeNull();
    expect(primaryAddress(undefined)).toBeNull();
  });

  it("falls back to the first address when none is flagged primary", () => {
    expect(primaryAddress([{ line1: "A" }, { line1: "B" }])?.line1).toBe("A");
  });
});
