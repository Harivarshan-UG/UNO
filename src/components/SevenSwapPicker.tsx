"use client";

import { useEffect, useMemo } from "react";
import type { ClientMessage } from "../shared/protocol";
import type { ClientView } from "../engine/types";
import { usePlaySound } from "../hooks/use-play-sound";

/**
 * Modal overlay shown when the local player just played a 7 under the sevenSwap
 * rule and still owes a target pick. Lists every other seat and sends
 * `chooseSevenSwapTarget` on click. Blocks the table beneath so the player
 * can't accidentally try to play or draw while the swap is pending.
 *
 * Mounted on `RoomClient` so one component covers both desktop (`GameTable`)
 * and mobile (`MobileGameTable`) without either table owning the overlay.
 */
export function SevenSwapPicker({
  view,
  send,
}: {
  view: ClientView;
  send: (msg: ClientMessage) => void;
}) {
  const pending = view.pendingSevenSwap;
  const openSfx = usePlaySound({ sound: "overlay.open" });
  const pickSfx = usePlaySound({ sound: "interaction.confirm" });

  // Fire the open sound once each time the pending state appears.
  useEffect(() => {
    if (pending) openSfx.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.playerId]);

  const choices = useMemo(() => {
    if (!pending) return [];
    return view.players
      .filter((p) => p.playerId !== pending.playerId)
      .sort((a, b) => a.seat - b.seat);
  }, [pending, view.players]);

  if (!pending) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick a seat to swap hands with"
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm px-4 py-6 seven-swap-fade"
    >
      <div className="w-full max-w-md bg-uno-cream border-2 border-uno-ink/15 rounded-card shadow-[0_18px_40px_rgba(0,0,0,0.35)] seven-swap-pop">
        <div className="px-5 pt-5 pb-3 text-center">
          <div className="inline-block px-3 py-1 rounded-full bg-uno-red text-uno-cream font-extrabold uppercase tracking-wider text-xs">
            7 played
          </div>
          <h2 className="font-display text-2xl sm:text-3xl mt-3 mb-1 text-uno-ink">
            Swap hands with…
          </h2>
          <p className="text-sm text-uno-ink2">
            Your hand goes to them. Theirs comes to you.
          </p>
        </div>
        <ul className="px-4 pb-4 grid grid-cols-1 gap-2 max-h-[55vh] overflow-y-auto">
          {choices.map((p) => (
            <li key={p.playerId}>
              <button
                type="button"
                onClick={() => {
                  pickSfx.play();
                  send({ type: "chooseSevenSwapTarget", targetSeat: p.seat });
                }}
                disabled={!p.connected}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-card bg-uno-white1 border-2 border-uno-ink/10 hover:border-uno-red hover:bg-uno-white2 active:translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed transition text-left"
              >
                <Avatar name={p.displayName} seat={p.seat} />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-uno-ink truncate">
                    {p.displayName}
                    {!p.connected && (
                      <span className="ml-2 text-xs font-medium text-uno-ink2">
                        (offline)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-uno-ink2 tabular-nums">
                    {p.handCount} card{p.handCount === 1 ? "" : "s"} · seat{" "}
                    {p.seat + 1}
                  </div>
                </div>
                <ArrowRight />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const SEAT_HUES = [
  "bg-uno-red",
  "bg-uno-blue",
  "bg-uno-green",
  "bg-uno-yellow",
  "bg-uno-ink",
] as const;

function Avatar({ name, seat }: { name: string; seat: number }) {
  const hue = SEAT_HUES[seat % SEAT_HUES.length];
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className={`shrink-0 grid place-items-center w-11 h-11 rounded-full ${hue} text-uno-cream font-extrabold border-2 border-uno-ink/10`}
    >
      {initials || "?"}
    </div>
  );
}

function ArrowRight() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      className="shrink-0 text-uno-ink2"
      aria-hidden
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
