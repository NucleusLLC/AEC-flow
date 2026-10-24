"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { track } from "@vercel/analytics";

export function PrintViewTracker() {
  const pathname = usePathname();
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    const route = pathname.split("/")[2] || "";
    track("print_view", { route });
  }, [pathname]);

  return null;
}
