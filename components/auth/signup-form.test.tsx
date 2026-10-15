import { afterEach, expect, it, vi } from "vitest";
import { track } from "@vercel/analytics";
import { signIn } from "next-auth/react";
import { registerBetaTester } from "@/app/signup/actions";
import { SignupForm } from "./signup-form";

vi.mock("@vercel/analytics", () => ({ track: vi.fn() }));
vi.mock("@/app/signup/actions", () => ({ registerBetaTester: vi.fn() }));
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/i18n/language-provider", () => ({ useT: () => (s: string) => s }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => [initial, vi.fn()],
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it.each([["?utm_source=campaign", "campaign"], ["", "direct"]])(
  "tracks successful signup with source from %s before signing in",
  async (search, source) => {
    vi.stubGlobal("window", { location: { search } });
    vi.mocked(registerBetaTester).mockResolvedValue({ ok: true });
    vi.mocked(signIn).mockResolvedValue(undefined);
    const form = SignupForm();
    await form.props.onSubmit({ preventDefault: vi.fn() });
    expect(track).toHaveBeenCalledExactlyOnceWith("signup_completed", { source });
    expect(vi.mocked(track).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(signIn).mock.invocationCallOrder[0],
    );
  },
);
