"use client";

import { AVATAR_COUNT, Avatar } from "./Avatar";
import { usePlaySound } from "../hooks/use-play-sound";

/**
 * 8-slot avatar picker. Controlled component — the parent owns `value` and
 * receives `onChange` when the player taps a tile. Used on the NameGate before
 * a player enters a room.
 */
export function AvatarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (id: number) => void;
}) {
  const tapSfx = usePlaySound({ sound: "interaction.tap" });
  return (
    <div>
      <div className="text-xs font-extrabold uppercase tracking-wider text-uno-ink2 mb-2 text-center">
        Pick an avatar
      </div>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: AVATAR_COUNT }).map((_, i) => {
          const selected = value === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                tapSfx.play();
                onChange(i);
              }}
              aria-pressed={selected}
              aria-label={`Avatar ${i + 1}`}
              className={`relative grid place-items-center rounded-card p-1.5 border-2 transition ${
                selected
                  ? "border-uno-red bg-uno-cream shadow-[0_3px_0_rgba(43,42,39,0.22)]"
                  : "border-uno-ink/10 bg-uno-white1 hover:border-uno-ink/30"
              }`}
            >
              <Avatar id={i} size={48} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
