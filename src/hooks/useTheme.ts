"use client";

import { useEffect, useState } from "react";

export const THEMES = ["groovy", "dark", "neon", "glass"] as const;
export type Theme = (typeof THEMES)[number];

const KEY = "uno:theme";

/**
 * Global app theme: reads the saved choice from localStorage on mount, applies
 * it as a class on <html>, and returns a setter that updates both the DOM and
 * storage. The default "groovy" theme corresponds to the stock CSS (no class),
 * so it's also the SSR-safe initial value.
 */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>("groovy");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && (THEMES as readonly string[]).includes(saved)) {
        setThemeState(saved as Theme);
      }
    } catch {
      /* private mode etc. — fall back to default. */
    }
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    THEMES.forEach((t) => el.classList.remove(`theme-${t}`));
    if (theme !== "groovy") el.classList.add(`theme-${theme}`);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(KEY, t);
    } catch {}
  };

  return [theme, setTheme];
}
