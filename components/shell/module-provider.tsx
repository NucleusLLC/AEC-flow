"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_MODULE,
  MODULE_COOKIE,
  MODULE_MAP,
  MODULES,
  getModule,
  isModuleKey,
  type AppModule,
  type ModuleKey,
} from "@/lib/modules";

interface ModuleContextValue {
  moduleKey: ModuleKey;
  module: AppModule;
  modules: AppModule[];
  /** Switch active module. `navigate` (default true) lands on its dashboard. */
  setModule: (key: ModuleKey, navigate?: boolean) => void;
}

const ModuleContext = createContext<ModuleContextValue | null>(null);

function persist(key: ModuleKey) {
  try {
    // 1-year cookie so the server layout can render the right nav on first paint.
    document.cookie = `${MODULE_COOKIE}=${key}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    /* cookies may be unavailable; state still applies for this session */
  }
}

export function ModuleProvider({
  initial,
  children,
}: {
  initial?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [moduleKey, setModuleKey] = useState<ModuleKey>(
    isModuleKey(initial) ? initial : DEFAULT_MODULE,
  );

  const setModule = useCallback(
    (key: ModuleKey, navigate = true) => {
      if (!MODULE_MAP[key]) return;
      setModuleKey(key);
      persist(key);
      if (navigate) router.push(MODULE_MAP[key].dashboardHref);
    },
    [router],
  );

  const value = useMemo<ModuleContextValue>(
    () => ({ moduleKey, module: getModule(moduleKey), modules: MODULES, setModule }),
    [moduleKey, setModule],
  );

  return <ModuleContext.Provider value={value}>{children}</ModuleContext.Provider>;
}

export function useModule(): ModuleContextValue {
  const ctx = useContext(ModuleContext);
  if (!ctx) throw new Error("useModule must be used within a ModuleProvider");
  return ctx;
}
