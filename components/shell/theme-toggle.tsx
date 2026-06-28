"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  // Reflect the class the pre-paint script already applied.
  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    sync();
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable — toggle still applies for this session */
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Toggle dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
      className="relative inline-flex h-8 w-[60px] shrink-0 items-center rounded-full border border-border bg-surface-2 px-1 transition-colors"
    >
      <Sun className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-amber-500" />
      <Moon className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-indigo-400" />
      <span
        className={`relative z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface shadow-sm transition-transform duration-200 ${
          dark ? "translate-x-[28px]" : "translate-x-0"
        }`}
      >
        {dark ? (
          <Moon className="h-3.5 w-3.5 text-indigo-400" />
        ) : (
          <Sun className="h-3.5 w-3.5 text-amber-500" />
        )}
      </span>
    </button>
  );
}
