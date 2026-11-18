"use client";

import { useEffect, useState } from "react";
import { AvatarPicker } from "./AvatarPicker";
import { getAvatarId } from "../lib/identity";

export function NameGate({
  code,
  onSubmit,
}: {
  code: string;
  /** Receives the player's name and chosen avatar id when they tap Join. */
  onSubmit: (name: string, avatarId: number) => void;
}) {
  const [name, setName] = useState("");
  const [avatarId, setAvatarId] = useState(0);

  // Restore the last pick for this room (if any) so returning players don't
  // see avatar #0 selected after a refresh.
  useEffect(() => {
    const saved = getAvatarId(code);
    if (saved !== null) setAvatarId(saved);
  }, [code]);

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onSubmit(n, avatarId);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <div className="text-sm font-semibold text-uno-ink1">Joining room</div>
        <div className="font-display text-4xl tracking-[0.15em] mt-1">{code}</div>
      </div>
      <div className="flex flex-col gap-4 w-80 max-w-full">
        <AvatarPicker value={avatarId} onChange={setAvatarId} />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={20}
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="bg-uno-white1 border-2 border-uno-ink/15 rounded-card px-4 py-3 outline-none placeholder:text-uno-ink2 hover:border-uno-ink/25 focus:border-uno-blue transition"
        />
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="bg-uno-green text-uno-cream font-extrabold uppercase tracking-wide py-3 rounded-card border-2 border-uno-ink/15 shadow-[0_5px_0_rgba(43,42,39,0.25)] hover:-translate-y-0.5 hover:brightness-[1.04] hover:shadow-[0_7px_0_rgba(43,42,39,0.25)] active:translate-y-[3px] active:shadow-none disabled:opacity-40 disabled:translate-y-0 disabled:shadow-none disabled:hover:brightness-100 transition"
        >
          Join
        </button>
      </div>
    </main>
  );
}
