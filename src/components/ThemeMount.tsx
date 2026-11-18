"use client";

import { useTheme } from "../hooks/useTheme";

/**
 * Invisible mount that initialises the theme: reads the saved choice from
 * localStorage and applies `html.theme-*` on every page load. The SettingsModal
 * also calls useTheme to let the user change it; this mount guarantees the
 * saved theme is picked up even on pages where settings never open.
 */
export function ThemeMount() {
  useTheme();
  return null;
}
