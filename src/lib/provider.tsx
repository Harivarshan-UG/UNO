"use client";

import * as React from "react";
import {
  closeAudioContext,
  playSound as enginePlaySound,
  type PlaySoundOptions,
  type SoundPlayback,
} from "./engine";
import {
  defaultConfig,
  mergeConfig,
  resolveRole,
  type SensoryUIConfig,
} from "./config";
import type { SoundRole } from "./sound-roles";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface SensoryUIContextValue {
  /**
   * Play a sound by its semantic role.
   * Returns a SoundPlayback handle or null if suppressed.
   */
  playSound: (
    role: SoundRole,
    options?: PlaySoundOptions
  ) => Promise<SoundPlayback | null>;
  /** Whether the sound system is globally active. */
  enabled: boolean;
  /** Current master volume (0–1). */
  volume: number;
  /** Whether the user has manually muted all sounds. */
  muted: boolean;
  /** Toggle the mute state programmatically. */
  setMuted: (muted: boolean) => void;
  /** Set the effective master volume (0..1), clamped. Persists to localStorage. */
  setVolume: (volume: number) => void;
  /**
   * Whether the sound engine is currently suppressing audio due to
   * motion-reduction settings. This is `true` in two cases:
   *
   * - The OS/browser `prefers-reduced-motion: reduce` media query is active
   *   **and** `config.reducedMotion` is `"inherit"` (the default).
   * - `config.reducedMotion` is `"force-off"`, meaning sounds are always
   *   suppressed regardless of the OS preference (treat as if motion is reduced).
   *
   * It is `false` when `config.reducedMotion` is `"force-on"`, even if the
   * OS preference is active.
   *
   * Use this to decide whether to surface a hint to users who report not
   * hearing sounds.
   */
  reducedMotion: boolean;
}

const SensoryUIContext = React.createContext<SensoryUIContextValue | null>(
  null
);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSensoryUI(): SensoryUIContextValue {
  const ctx = React.useContext(SensoryUIContext);
  if (!ctx) {
    throw new Error(
      "[sensory-ui] useSensoryUI must be called inside <SensoryUIProvider>"
    );
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Reduced-motion hook
// ---------------------------------------------------------------------------

function useReducedMotion(
  pref: SensoryUIConfig["reducedMotion"]
): boolean {
  const [matches, setMatches] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (pref === "force-off") return true;
  if (pref === "force-on") return false;
  return matches;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface SensoryUIProviderProps {
  children: React.ReactNode;
  /**
   * Optional config overrides merged on top of the defaults in config.ts.
   * Useful for Storybook, tests, or dynamic settings.
   *
   * @example
   * // Disable all sounds in tests
   * <SensoryUIProvider config={{ enabled: false }}>
   */
  config?: Partial<SensoryUIConfig>;
}

export function SensoryUIProvider({
  children,
  config: configOverride,
}: SensoryUIProviderProps) {
  const config = React.useMemo(
    () => mergeConfig(configOverride ?? {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(configOverride)]
  );

  // Audio preferences are per-browser, not per-room — stash in localStorage so
  // they survive reloads (and so "I turned the music off" actually sticks).
  const [muted, setMutedState] = React.useState(false);
  const [volumeOverride, setVolumeOverride] = React.useState<number | null>(null);
  React.useEffect(() => {
    try {
      const m = localStorage.getItem("sfx.muted");
      if (m !== null) setMutedState(m === "1");
      const v = localStorage.getItem("sfx.volume");
      if (v !== null) {
        const n = Number(v);
        if (Number.isFinite(n)) setVolumeOverride(Math.max(0, Math.min(1, n)));
      }
    } catch {
      /* private mode, denied storage — fall back to defaults silently. */
    }
  }, []);
  const setMuted = React.useCallback((next: boolean) => {
    setMutedState(next);
    try {
      localStorage.setItem("sfx.muted", next ? "1" : "0");
    } catch {}
  }, []);
  const setVolume = React.useCallback((next: number) => {
    const v = Math.max(0, Math.min(1, next));
    setVolumeOverride(v);
    try {
      localStorage.setItem("sfx.volume", String(v));
    } catch {}
  }, []);
  const effectiveVolume = volumeOverride ?? config.volume;
  const reducedMotion = useReducedMotion(config.reducedMotion);
  const shouldPlay = config.enabled && !muted && !reducedMotion;

  const playSound = React.useCallback(
    async (
      role: SoundRole,
      options: PlaySoundOptions = {}
    ): Promise<SoundPlayback | null> => {
      if (typeof window === "undefined") return null;
      if (!shouldPlay) return null;

      const finalVolume = (options.volume ?? 1) * effectiveVolume;

      // Detect raw URLs / data-URIs passed via usePlaySound and bypass
      // role resolution — send them straight to the engine.
      const isRawSource =
        typeof role === "string" &&
        (role.startsWith("/") ||
          role.startsWith("http://") ||
          role.startsWith("https://") ||
          role.startsWith("data:"));

      const source = isRawSource ? role : resolveRole(role, config);
      if (!source) return null;

      try {
        return await enginePlaySound(source, { ...options, volume: finalVolume });
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[sensory-ui] Failed to play sound:", role, err);
        }
        return null;
      }
    },
    [shouldPlay, config, effectiveVolume]
  );

  // Clean up the AudioContext on unmount in development to avoid stale state
  // across HMR reloads.
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    return () => {
      void closeAudioContext();
    };
  }, []);

  const value = React.useMemo(
    () => ({
      playSound,
      enabled: shouldPlay,
      volume: effectiveVolume,
      muted,
      setMuted,
      setVolume,
      reducedMotion,
    }),
    [playSound, shouldPlay, effectiveVolume, muted, reducedMotion, setMuted, setVolume]
  );

  return (
    <SensoryUIContext.Provider value={value}>
      {children}
    </SensoryUIContext.Provider>
  );
}
