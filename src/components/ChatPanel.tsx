"use client";

import { useEffect, useRef, useState } from "react";
import type { ClientView } from "../engine/types";
import type { ClientMessage } from "../shared/protocol";
import { usePlaySound } from "../hooks/use-play-sound";

/**
 * Minimal text chat for the lobby. Renders the rolling `chatLog` from the
 * server view and posts new messages via the `chat` client message. Stays
 * fully controlled — no local message store — so every client sees the same
 * server-ordered log and a reconnect doesn't miss anything.
 */
export function ChatPanel({
  view,
  send,
}: {
  view: ClientView;
  send: (m: ClientMessage) => void;
}) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const sendSfx = usePlaySound({ sound: "interaction.subtle" });

  // Keep the newest message in view without hijacking a user who has scrolled
  // up to re-read earlier chat.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [view.chatLog.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    send({ type: "chat", text: t.slice(0, 200) });
    sendSfx.play();
    setDraft("");
  };

  return (
    <section
      aria-label="Lobby chat"
      className="w-full bg-uno-white1/80 border-2 border-uno-ink/10 rounded-card overflow-hidden flex flex-col"
    >
      <header className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wider text-uno-ink2 border-b border-uno-ink/10">
        Chat
      </header>
      <div
        ref={listRef}
        className="flex-1 min-h-[6.5rem] max-h-[11rem] overflow-y-auto px-3 py-2 text-sm flex flex-col gap-1.5"
      >
        {view.chatLog.length === 0 ? (
          <div className="text-uno-ink2 text-xs italic py-2 text-center">
            Say hi to warm up the room.
          </div>
        ) : (
          view.chatLog.map((m) => {
            const mine = m.playerId === view.youPlayerId;
            return (
              <div key={m.id} className="leading-snug">
                <span
                  className={`font-bold mr-1.5 ${mine ? "text-uno-red" : "text-uno-ink"}`}
                >
                  {m.name}:
                </span>
                <span className="text-uno-ink break-words">{m.text}</span>
              </div>
            );
          })
        )}
      </div>
      <form
        onSubmit={submit}
        className="flex gap-2 px-2 py-2 border-t border-uno-ink/10 bg-uno-cream/40"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={200}
          placeholder="Message everyone…"
          className="flex-1 bg-uno-cream border-2 border-uno-ink/15 rounded-[12px] px-3 py-2 text-sm text-uno-ink focus:outline-none focus:border-uno-blue"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="shrink-0 bg-uno-red text-uno-cream font-extrabold uppercase tracking-wide px-3 py-2 rounded-[12px] border-2 border-uno-ink/15 disabled:opacity-40 active:translate-y-[2px] transition"
        >
          Send
        </button>
      </form>
    </section>
  );
}
