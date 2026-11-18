"use client";

import { useEffect } from "react";
import { useSensoryUI } from "../lib/provider";

/**
 * Audio + accessibility settings overlay. Opened from the speaker toggle. Keeps
 * its state in the sensory-ui provider (which persists to localStorage), so
 * closing and reopening preserves every setting without a round-trip to the
 * server.
 */
export function SettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { muted, setMuted, volume, setVolume, reducedMotion } = useSensoryUI();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-6 seven-swap-fade"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-uno-cream border-2 border-uno-ink/15 rounded-card shadow-[0_18px_40px_rgba(0,0,0,0.35)] seven-swap-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-uno-ink/10">
          <h2 className="font-display text-2xl text-uno-ink">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-uno-white2 transition text-uno-ink1"
          >
            <X />
          </button>
        </header>

        <div className="px-5 py-4 flex flex-col gap-4">
          <section>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="sfx-mute" className="font-semibold text-uno-ink">
                Sound
              </label>
              <button
                id="sfx-mute"
                type="button"
                role="switch"
                aria-checked={!muted}
                onClick={() => setMuted(!muted)}
                className={`w-14 h-8 rounded-full p-1 border-2 transition ${
                  !muted
                    ? "bg-uno-green border-uno-ink/15"
                    : "bg-uno-white2 border-uno-ink/10"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-uno-cream shadow-[0_1px_2px_rgba(43,42,39,0.3)] transition-transform ${
                    !muted ? "translate-x-6" : ""
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <SpeakerIcon />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                disabled={muted}
                onChange={(e) => setVolume(Number(e.target.value))}
                aria-label="Volume"
                className="flex-1 accent-uno-red disabled:opacity-40"
              />
              <span className="w-8 text-right text-xs tabular-nums text-uno-ink2">
                {Math.round((muted ? 0 : volume) * 100)}
              </span>
            </div>
          </section>

          <section className="pt-3 border-t border-uno-ink/10 text-xs text-uno-ink2 leading-relaxed">
            <p className="font-semibold text-uno-ink mb-1">Motion</p>
            {reducedMotion ? (
              <p>
                Reduced-motion is active (from your OS / browser settings), so
                animations and sounds are suppressed.
              </p>
            ) : (
              <p>
                Full animations are on. To reduce motion, enable
                "Reduce motion" in your OS accessibility settings.
              </p>
            )}
          </section>
        </div>

        <footer className="px-5 pb-4 pt-1 text-[11px] text-uno-ink2">
          Esc or tap outside to close.
        </footer>
      </div>
    </div>
  );
}

function SpeakerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden className="text-uno-ink1 shrink-0">
      <path
        d="M4 9v6h4l5 4V5L8 9H4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function X() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
