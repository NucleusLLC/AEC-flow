import { beforeEach, expect, it, vi } from "vitest";
import { track } from "@vercel/analytics";
import { PrintViewTracker } from "./print-view-tracker";

const hooks = vi.hoisted(() => ({
  effect: undefined as undefined | (() => void),
  ref: { current: false },
}));
vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/print/proposals/abc" }));
vi.mock("react", () => ({
  useEffect: (effect: () => void) => { hooks.effect = effect; },
  useRef: () => hooks.ref,
}));

beforeEach(() => {
  vi.clearAllMocks();
  hooks.ref.current = false;
});

it("tracks the document route once, including when React replays the effect", () => {
  expect(PrintViewTracker()).toBeNull();
  hooks.effect!();
  hooks.effect!();
  expect(track).toHaveBeenCalledExactlyOnceWith("print_view", { route: "proposals" });
});
