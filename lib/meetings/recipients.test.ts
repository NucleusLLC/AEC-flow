import { describe, it, expect } from "vitest";
import {
  normaliseName,
  addressInText,
  resolveAttendees,
  prefilledAddresses,
  unreachable,
  unreachableNotice,
  minutesSubject,
  minutesEmailBody,
  MAX_PREFILLED,
  type Addressable,
} from "@/lib/meetings/recipients";

const team: Addressable[] = [
  { name: "Greg Lacle", email: "greg@zenarch.test", kind: "team" },
  { name: "Mike Croes", email: "mike.croes@zenarch.test", kind: "team" },
];
const client: Addressable[] = [
  { name: "Gwendoline Rojer", email: "gwendoline@example.com", kind: "client" },
];
const people = [...team, ...client];

describe("normaliseName", () => {
  it("ignores the firm a participant is listed under", () => {
    expect(normaliseName("Greg Lacle (ZenArch)")).toBe("greg lacle");
    expect(normaliseName("Sherwin Howell (HTESS)")).toBe("sherwin howell");
  });

  it("ignores case, accents, punctuation and doubled spaces", () => {
    expect(normaliseName("  GRÉG   Lacle ")).toBe("greg lacle");
    expect(normaliseName("Greg Lacle,")).toBe("greg lacle");
  });
});

describe("addressInText", () => {
  it("reads an address typed into the name field", () => {
    expect(addressInText("hugo@example.com")).toBe("hugo@example.com");
    expect(addressInText("Hugo Rojer <hugo@example.com>")).toBe("hugo@example.com");
  });

  it("is not fooled by a name that merely looks like one", () => {
    expect(addressInText("Hugo Rojer")).toBeNull();
    expect(addressInText("Hugo @ site")).toBeNull();
    expect(addressInText("hugo@localhost")).toBeNull();
  });
});

describe("resolveAttendees", () => {
  it("places a participant against the team and the client", () => {
    const resolved = resolveAttendees(["Greg Lacle (ZenArch)", "Gwendoline Rojer"], people);
    expect(resolved).toEqual([
      { participant: "Greg Lacle (ZenArch)", email: "greg@zenarch.test", kind: "team" },
      { participant: "Gwendoline Rojer", email: "gwendoline@example.com", kind: "client" },
    ]);
  });

  it("reports the ones it cannot place rather than dropping them", () => {
    const resolved = resolveAttendees(["Greg Lacle", "Sherwin Howell (HTESS)"], people);
    expect(resolved[1]).toEqual({ participant: "Sherwin Howell (HTESS)", email: null, kind: null });
    expect(unreachable(resolved)).toEqual(["Sherwin Howell (HTESS)"]);
  });

  it("refuses a first-name or partial match", () => {
    // "Mike" would otherwise address a client's minutes to whichever Mike came
    // first in the team list, and the To line would not show that it guessed.
    expect(resolveAttendees(["Mike"], people)[0].email).toBeNull();
    expect(resolveAttendees(["Croes"], people)[0].email).toBeNull();
    expect(resolveAttendees(["Mike Croes Jr"], people)[0].email).toBeNull();
  });

  it("prefers the work address when someone is on both lists", () => {
    const both: Addressable[] = [
      { name: "Greg Lacle", email: "greg@zenarch.test", kind: "team" },
      { name: "Greg Lacle", email: "greg@othercompany.test", kind: "client" },
    ];
    expect(resolveAttendees(["Greg Lacle"], both)[0]).toMatchObject({
      email: "greg@zenarch.test",
      kind: "team",
    });
  });

  it("skips blank participant rows the form may have left behind", () => {
    expect(resolveAttendees(["", "   ", "Greg Lacle"], people)).toHaveLength(1);
  });

  it("holds an address someone typed as a participant", () => {
    expect(resolveAttendees(["Hugo Rojer <hugo@example.com>"], people)[0]).toEqual({
      participant: "Hugo Rojer <hugo@example.com>",
      email: "hugo@example.com",
      kind: "typed",
    });
  });
});

describe("prefilledAddresses", () => {
  it("keeps the order of the minutes and mails nobody twice", () => {
    const resolved = resolveAttendees(["Gwendoline Rojer", "Greg Lacle", "Greg Lacle"], people);
    expect(prefilledAddresses(resolved)).toEqual(["gwendoline@example.com", "greg@zenarch.test"]);
  });

  it("collapses a case-different duplicate from the extra list", () => {
    const resolved = resolveAttendees(["Greg Lacle"], people);
    expect(prefilledAddresses(resolved, ["GREG@zenarch.test"])).toEqual(["greg@zenarch.test"]);
  });

  it("adds an assignee who was not at the meeting", () => {
    const resolved = resolveAttendees(["Greg Lacle"], people);
    expect(prefilledAddresses(resolved, ["mike.croes@zenarch.test"])).toEqual([
      "greg@zenarch.test",
      "mike.croes@zenarch.test",
    ]);
  });

  it("stops at the cap the send path enforces, rather than opening a dialog that cannot send", () => {
    const many = Array.from({ length: MAX_PREFILLED + 3 }, (_, i) => `p${i}@example.com`);
    expect(prefilledAddresses([], many)).toHaveLength(MAX_PREFILLED);
  });
});

describe("unreachableNotice", () => {
  it("says nothing when everyone was placed", () => {
    expect(unreachableNotice(resolveAttendees(["Greg Lacle"], people))).toBeNull();
  });

  it("names the one person who is missing, and what to do", () => {
    const notice = unreachableNotice(resolveAttendees(["Sherwin Howell (HTESS)"], people));
    expect(notice).toContain("Sherwin Howell (HTESS)");
    expect(notice).toContain("no email address on file");
  });

  it("names all of them when several are missing", () => {
    const notice = unreachableNotice(resolveAttendees(["A Person", "B Person"], people));
    expect(notice).toContain("A Person, B Person");
  });
});

describe("the message", () => {
  const input = {
    title: "Villa Sabana — site meeting",
    projectName: "Villa Sabana",
    typeLabel: "Client",
    meetingDate: "10 Sept 2026",
    location: "Site, Sabana Liber 12",
    author: "Greg Lacle",
    followUpDate: "24 Sept 2026",
    participants: ["Greg Lacle (ZenArch)", "Gwendoline Rojer"],
    summary: "Scope, honorarium and the sewage connection.",
    discussion: "Discussed the honorarium.\nAnd the lead times.",
    decisions: null,
    actionItems: [
      {
        description: "Confirm the Panama lead time in writing",
        assignee: "Mike Croes",
        dueDate: "17 Sept 2026",
        statusLabel: "Open",
      },
    ],
    senderName: "Greg Lacle",
  };

  it("names the meeting and its date in the subject", () => {
    expect(minutesSubject(input)).toBe("Minutes — Villa Sabana — site meeting (10 Sept 2026)");
  });

  it("carries the minutes themselves, because nothing can be attached", () => {
    const body = minutesEmailBody(input);
    expect(body).toContain("MEETING MINUTES — Villa Sabana — site meeting");
    expect(body).toContain("Villa Sabana");
    expect(body).toContain("Site, Sabana Liber 12");
    expect(body).toContain("Gwendoline Rojer");
    expect(body).toContain("Scope, honorarium and the sewage connection.");
    expect(body).toContain("And the lead times.");
    expect(body).toContain("1. Confirm the Panama lead time in writing");
    expect(body).toContain("Mike Croes · due 17 Sept 2026 · Open");
  });

  it("leaves out a section the meeting does not have, rather than printing an empty heading", () => {
    expect(minutesEmailBody(input)).not.toContain("DECISIONS");
    const bare = minutesEmailBody({
      ...input,
      summary: null,
      discussion: null,
      location: null,
      followUpDate: null,
      participants: [],
      actionItems: [],
    });
    expect(bare).not.toContain("PARTICIPANTS");
    expect(bare).not.toContain("ACTION ITEMS");
    expect(bare).not.toContain("Location:");
    expect(bare).not.toContain("Follow-up:");
  });

  it("asks for corrections, because receipt is when a record is disputed", () => {
    expect(minutesEmailBody(input)).toContain("correction or omission");
  });

  it("signs off with the person sending it", () => {
    expect(minutesEmailBody(input).trimEnd().endsWith("Greg Lacle")).toBe(true);
  });
});
