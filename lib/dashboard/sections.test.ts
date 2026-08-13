import { describe, it, expect } from "vitest";
import { DASHBOARD_BACKGROUNDS } from "./backgrounds";
import {
  SECTION_BACKGROUNDS,
  SECTION_KEYS,
  type SectionKey,
  backgroundSet,
  nextBackground,
  sectionForPath,
  startBackground,
  usableBackgrounds,
} from "./sections";

const ALL_DEAD = (section: SectionKey) => SECTION_BACKGROUNDS[section].map((b) => b.id);
const DEAD_GENERIC = DASHBOARD_BACKGROUNDS.map((b) => b.id);

describe("section manifests", () => {
  it("covers exactly the thirteen agreed sections", () => {
    expect([...SECTION_KEYS]).toEqual([
      "architecture",
      "engineering",
      "interior",
      "design",
      "estimating",
      "schedule",
      "projects",
      "construction",
      "procurement",
      "drawings",
      "business",
      "people",
      "reports",
    ]);
    expect(Object.keys(SECTION_BACKGROUNDS).sort()).toEqual([...SECTION_KEYS].sort());
  });

  it("carries four photos per section on the agreed file contract", () => {
    for (const section of SECTION_KEYS) {
      const set = SECTION_BACKGROUNDS[section];
      expect(set).toHaveLength(4);
      set.forEach((bg, i) => {
        expect(bg.src).toBe(`/backgrounds/${section}/0${i + 1}.jpg`);
        expect(bg.label.length).toBeGreaterThan(0);
        expect(bg.description.length).toBeGreaterThan(0);
      });
    }
  });

  it("keeps every id unique across all fourteen sets — dead images are tracked by id", () => {
    const ids = [
      ...DASHBOARD_BACKGROUNDS.map((b) => b.id),
      ...SECTION_KEYS.flatMap((s) => SECTION_BACKGROUNDS[s].map((b) => b.id)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(12 + 13 * 4);
  });

  it("stays under /backgrounds/, which is the path proxy.ts exempts", () => {
    for (const section of SECTION_KEYS) {
      for (const bg of SECTION_BACKGROUNDS[section]) {
        expect(bg.src.startsWith("/backgrounds/")).toBe(true);
      }
    }
  });

  it("hands back the generic set for no section", () => {
    expect(backgroundSet(null)).toBe(DASHBOARD_BACKGROUNDS);
    expect(backgroundSet("engineering")).toBe(SECTION_BACKGROUNDS.engineering);
  });
});

describe("sectionForPath", () => {
  it("maps every published route to its section", () => {
    const table: ReadonlyArray<[string, SectionKey]> = [
      ["/design/architecture", "architecture"],
      ["/design/engineering", "engineering"],
      ["/design/interior", "interior"],
      ["/design", "design"],
      ["/design/new", "design"],
      ["/design/deliverable/abc123", "design"],
      ["/design/service-proposals", "design"],
      ["/design/service-proposals/abc/analytics", "design"],
      ["/estimates", "estimating"],
      ["/cost-database", "estimating"],
      ["/schedule", "schedule"],
      ["/tasks", "schedule"],
      ["/projects", "projects"],
      ["/development", "projects"],
      ["/construction-admin", "construction"],
      ["/procurement", "procurement"],
      ["/materials", "procurement"],
      ["/drawings", "drawings"],
      ["/documents", "drawings"],
      ["/clients", "business"],
      ["/proposals", "business"],
      ["/orders", "business"],
      ["/meetings", "business"],
      ["/team", "people"],
      ["/chat", "people"],
      ["/leave", "people"],
      ["/reports", "reports"],
      ["/activity", "reports"],
      ["/widgets", "reports"],
      ["/imports", "reports"],
      ["/exports", "reports"],
      ["/beta-reports", "reports"],
    ];
    for (const [path, section] of table) {
      expect(sectionForPath(path)).toBe(section);
    }
  });

  it("gives the discipline registers precedence over /design", () => {
    // The whole reason matching is longest-prefix-first.
    expect(sectionForPath("/design/architecture")).toBe("architecture");
    expect(sectionForPath("/design/architecture/anything/deeper")).toBe("architecture");
    expect(sectionForPath("/design/engineering")).toBe("engineering");
    expect(sectionForPath("/design/interior")).toBe("interior");
    // …and only for those three: a fourth slug is still the register.
    expect(sectionForPath("/design/landscape")).toBe("design");
  });

  it("inherits the section on detail routes", () => {
    expect(sectionForPath("/projects/clx123")).toBe("projects");
    expect(sectionForPath("/estimates/clx123/edit")).toBe("estimating");
    expect(sectionForPath("/construction-admin/rfi/7")).toBe("construction");
  });

  it("returns null for routes that belong to no section", () => {
    for (const path of [
      "/dashboard",
      "/modules",
      "/modules/complete-aec",
      "/settings",
      "/settings/preferences",
      "/account",
      "/admin",
      "/search",
      "/notifications",
      "/forms",
      "/",
      "/expired",
    ]) {
      expect(sectionForPath(path)).toBeNull();
    }
  });

  it("matches whole segments only — a prefix is not a substring", () => {
    expect(sectionForPath("/designer")).toBeNull();
    expect(sectionForPath("/design-system")).toBeNull();
    expect(sectionForPath("/estimates-archive")).toBeNull();
    expect(sectionForPath("/teamwork")).toBeNull();
  });

  it("tolerates whatever the router hands over", () => {
    expect(sectionForPath(null)).toBeNull();
    expect(sectionForPath(undefined)).toBeNull();
    expect(sectionForPath("")).toBeNull();
    expect(sectionForPath("/estimates/")).toBe("estimating");
    expect(sectionForPath("/estimates///")).toBe("estimating");
    expect(sectionForPath("/Design/Architecture")).toBe("architecture");
    expect(sectionForPath("/reports?range=90d")).toBe("reports");
    expect(sectionForPath("/reports#top")).toBe("reports");
    expect(sectionForPath("tasks")).toBe("schedule");
  });
});

describe("usableBackgrounds — a missing folder must not blank the app", () => {
  it("is the whole section when nothing has failed", () => {
    expect(usableBackgrounds("estimating")).toEqual(SECTION_BACKGROUNDS.estimating);
    expect(usableBackgrounds(null)).toEqual(DASHBOARD_BACKGROUNDS);
  });

  it("drops the entries whose file failed to load", () => {
    const live = usableBackgrounds("estimating", ["estimating-01", "estimating-03"]);
    expect(live.map((b) => b.id)).toEqual(["estimating-02", "estimating-04"]);
  });

  it("falls back to the generic set once a section is exhausted", () => {
    // Four 404s — an unfilled public/backgrounds/<section>/ folder.
    expect(usableBackgrounds("people", ALL_DEAD("people"))).toEqual(DASHBOARD_BACKGROUNDS);
  });

  it("is empty only when the generic set has died too", () => {
    expect(usableBackgrounds("people", [...ALL_DEAD("people"), ...DEAD_GENERIC])).toEqual([]);
    expect(usableBackgrounds(null, DEAD_GENERIC)).toEqual([]);
  });
});

describe("startBackground", () => {
  it("is deterministic in the seed — the server pick must survive hydration", () => {
    expect(startBackground("architecture", [], 7)).toBe(startBackground("architecture", [], 7));
  });

  it("stays inside the section for every seed the server can produce", () => {
    for (let seed = 0; seed < DASHBOARD_BACKGROUNDS.length; seed++) {
      const bg = startBackground("drawings", [], seed);
      expect(SECTION_BACKGROUNDS.drawings).toContain(bg);
    }
  });

  it("survives a nonsense seed", () => {
    for (const seed of [NaN, Infinity, -3, 1.7]) {
      expect(startBackground("reports", [], seed)).not.toBeNull();
    }
  });

  it("opens on a generic photo when the section has no usable file", () => {
    const bg = startBackground("people", ALL_DEAD("people"), 0);
    expect(DASHBOARD_BACKGROUNDS).toContain(bg);
  });

  it("is null only when there is nothing left anywhere", () => {
    expect(startBackground("people", [...ALL_DEAD("people"), ...DEAD_GENERIC])).toBeNull();
  });
});

describe("nextBackground", () => {
  it("advances and wraps inside the section", () => {
    expect(nextBackground("schedule", "schedule-01")?.id).toBe("schedule-02");
    expect(nextBackground("schedule", "schedule-04")?.id).toBe("schedule-01");
  });

  it("starts at the top of the set when the current photo is from elsewhere", () => {
    // Exactly what a cross-section move looks like.
    expect(nextBackground("interior", "engineering-03")?.id).toBe("interior-01");
    expect(nextBackground("interior", null)?.id).toBe("interior-01");
  });

  it("skips images that failed to load", () => {
    expect(nextBackground("business", "business-01", ["business-02"])?.id).toBe("business-03");
  });

  it("returns the only survivor rather than nothing", () => {
    const dead = ["projects-01", "projects-02", "projects-04"];
    expect(nextBackground("projects", "projects-03", dead)?.id).toBe("projects-03");
  });

  it("rotates the generic set once the section is exhausted", () => {
    const next = nextBackground("people", "people-04", ALL_DEAD("people"));
    expect(DASHBOARD_BACKGROUNDS).toContain(next);
  });

  it("returns null when every image everywhere is unusable", () => {
    expect(nextBackground("people", "people-01", [...ALL_DEAD("people"), ...DEAD_GENERIC])).toBeNull();
    expect(nextBackground(null, DASHBOARD_BACKGROUNDS[0]!.id, DEAD_GENERIC)).toBeNull();
  });
});
