"use client";

import { useEffect, useState } from "react";
import type { ClientView, RuleConfig, RulesetPreset } from "../engine/types";
import { usePlaySound } from "../hooks/use-play-sound";

/**
 * In-game Rule Book. Two parts:
 *  - a small floating "?" button fixed at the bottom-left of the game screen,
 *  - an overlay dialog that lists every active rule in human terms.
 *
 * Reads from `view.config`, so what the player sees is always the room's
 * currently effective rules, not a stale preset description. Grouped by:
 * ruleset header → base rules → variant extras → chain / stacking rules →
 * special-value rules → scoring.
 */
export function RuleBook({ view }: { view: ClientView }) {
  const [open, setOpen] = useState(false);
  const openSfx = usePlaySound({ sound: "overlay.open" });
  const closeSfx = usePlaySound({ sound: "overlay.close" });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (view.phase !== "in_round") return null;

  return (
    <>
      <button
        type="button"
        aria-label="Rules"
        title="Rules"
        onClick={() => {
          openSfx.play();
          setOpen(true);
        }}
        className="fixed bottom-4 left-4 z-[70] grid place-items-center w-11 h-11 rounded-full bg-uno-cream/85 backdrop-blur border-2 border-uno-ink/15 text-uno-ink1 hover:text-uno-ink hover:bg-uno-cream hover:-translate-y-0.5 active:translate-y-0 shadow-[0_3px_10px_rgba(43,42,39,0.22)] transition"
      >
        <BookIcon />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Rule book"
          className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-sm px-4 py-6 seven-swap-fade"
          onClick={() => {
            closeSfx.play();
            setOpen(false);
          }}
        >
          <div
            className="w-full max-w-md bg-uno-cream border-2 border-uno-ink/15 rounded-card shadow-[0_18px_40px_rgba(0,0,0,0.35)] seven-swap-pop max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-uno-ink/10">
              <div>
                <PresetChip preset={view.config.preset} />
                <h2 className="font-display text-2xl text-uno-ink mt-1.5 leading-tight">
                  Rule book
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  closeSfx.play();
                  setOpen(false);
                }}
                aria-label="Close rules"
                className="w-9 h-9 grid place-items-center rounded-full hover:bg-uno-white2 transition text-uno-ink1"
              >
                <XIcon />
              </button>
            </header>

            <div className="px-5 py-4 overflow-y-auto">
              <RuleList config={view.config} />
            </div>

            <footer className="px-5 pb-4 pt-1 text-[11px] text-uno-ink2 border-t border-uno-ink/10">
              Esc or tap outside to close.
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function RuleList({ config }: { config: RuleConfig }) {
  const items: { heading: string; rules: string[] }[] = [];

  // ---- Base (always shown) ----
  const base: string[] = [
    `Match a card by colour or by ${config.flipMode ? "value / symbol (reading the active side)" : "value or symbol"}.`,
    `Wild cards may be played any time — the player picks the next colour.`,
    `Deal size: ${config.dealSize} cards per player.`,
    `Max players: up to ${config.maxPlayers}.`,
  ];
  items.push({ heading: "Base rules", rules: base });

  // ---- UNO call ----
  if (config.unoCall) {
    items.push({
      heading: "Call UNO",
      rules: [
        `You must call UNO when you play your second-to-last card.`,
        `If you forget, an opponent can catch you — penalty: +${config.unoPenalty} cards.`,
      ],
    });
  } else {
    items.push({
      heading: "Call UNO",
      rules: ["UNO calls are off — no penalty for forgetting."],
    });
  }

  // ---- Stacking / chaining ----
  const stacking: string[] = [];
  if (config.stackDraw2OnDraw2)
    stacking.push("+2 may be chained onto a +2 (pass the stack along).");
  if (config.stackDraw4OnDraw2Or4)
    stacking.push(
      "+4 may be chained onto a +2 or +4. (+2 onto +4 is never allowed.)",
    );
  if (config.stacking)
    stacking.push(
      "Play several same-rank cards in a single turn — e.g. two 5s, two Skips, two Wilds.",
    );
  if (stacking.length === 0)
    stacking.push("Stacking and chaining are off — one card per turn.");
  items.push({ heading: "Stacking & chaining", rules: stacking });

  // ---- Draw / force rules ----
  const draws: string[] = [];
  draws.push(
    config.drawPenaltyBehavior === "drawUntilPlayable"
      ? "When you can't play, keep drawing until you can — then play that card."
      : "When you can't play, draw one card. If it's playable, you may play it or pass.",
  );
  if (config.forcePlay)
    draws.push("If the card you drew is playable, you MUST play it.");
  items.push({ heading: "Drawing", rules: draws });

  // ---- 7-0 & 0-rotate ----
  const seven: string[] = [];
  if (config.sevenSwap)
    seven.push(
      "Playing a 7 lets you swap your whole hand with any other player.",
    );
  if (config.zeroRotate)
    seven.push(
      "Playing a 0 rotates every hand in the current direction of play.",
    );
  if (seven.length > 0)
    items.push({ heading: "Seven & Zero", rules: seven });

  // ---- Flip variant ----
  if (config.flipMode) {
    items.push({
      heading: "Flip variant",
      rules: [
        "Every card has a light side and a dark side.",
        "A Flip card toggles the whole table to the other side.",
        "Dark side is harsher: +5 instead of +2, Skip-Everyone, Wild Draw-Colour.",
      ],
    });
  }

  // ---- Scoring ----
  items.push({
    heading: "Scoring",
    rules: [
      config.scoringMode === "singleRound"
        ? "First player to empty their hand wins the round. That ends the match."
        : `Round winner scores the point value of everyone else's remaining cards. First to ${config.targetScore} points wins the match.`,
    ],
  });

  return (
    <div className="flex flex-col gap-4 text-sm text-uno-ink">
      {items.map((section) => (
        <section key={section.heading}>
          <h3 className="font-extrabold uppercase tracking-wider text-[11px] text-uno-ink2 mb-1.5">
            {section.heading}
          </h3>
          <ul className="list-disc list-outside pl-5 space-y-1 leading-snug">
            {section.rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

const PRESET_HUE: Record<RulesetPreset, string> = {
  classic: "bg-uno-blue",
  no_mercy: "bg-uno-red",
  flip: "bg-uno-green",
  custom: "bg-uno-ink",
};
const PRESET_LABEL: Record<RulesetPreset, string> = {
  classic: "Classic",
  no_mercy: "No Mercy",
  flip: "Flip",
  custom: "Custom",
};

function PresetChip({ preset }: { preset: RulesetPreset }) {
  return (
    <span
      className={`${PRESET_HUE[preset]} text-uno-cream font-extrabold uppercase tracking-wider text-[10px] px-2.5 py-0.5 rounded-full border-2 border-uno-ink/15`}
    >
      {PRESET_LABEL[preset]}
    </span>
  );
}

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 1 4 16.5v-12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M4 18.5A1.5 1.5 0 0 1 5.5 17H19v4H5.5A1.5 1.5 0 0 1 4 19.5v-1z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M8 7h7M8 11h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
