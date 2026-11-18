import { nanoid } from "nanoid";
import { Card, Color, COLORS, NumberValue, Value } from "./types";

const NUMBERS: NumberValue[] = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ACTIONS: Value[] = ["skip", "reverse", "draw2"];
const DARK_ACTIONS: Value[] = ["skip_all", "reverse", "draw5"];

/** Build a standard 108-card deck with unique runtime uids. */
export function buildDeck(): Card[] {
  const cards: Card[] = [];
  const add = (color: Color | null, value: Value) =>
    cards.push({ uid: nanoid(10), color, value });

  for (const color of COLORS) {
    // one 0, two each of 1-9
    add(color, "0");
    for (const n of NUMBERS.slice(1)) {
      add(color, n);
      add(color, n);
    }
    // two each of skip / reverse / draw2
    for (const a of ACTIONS) {
      add(color, a);
      add(color, a);
    }
  }
  // four wild, four wild_draw4
  for (let i = 0; i < 4; i++) {
    add(null, "wild");
    add(null, "wild_draw4");
  }

  return cards;
}

/**
 * Build a Flip-variant deck. Each card has both a light face (the card's own
 * {color, value}) and a dark face attached as `card.darkSide`. Flip cards are
 * added — two per color — so the global side can be toggled mid-round.
 *
 * Dark-side content is a simplified port of official UNO Flip: number cards
 * flip to a different number (same color), action cards flip to a harsher
 * action on the same color, and wilds flip between Wild and Wild Draw 2 /
 * Wild Draw Color (represented here as `wild_draw4` for continuity).
 */
export function buildFlipDeck(): Card[] {
  const cards: Card[] = [];
  const addDual = (color: Color | null, light: Value, dark: Value) => {
    const uid = nanoid(10);
    const darkSide: Card = { uid: `${uid}_d`, color, value: dark };
    cards.push({ uid, color, value: light, darkSide });
  };

  // Deterministic dark-value picker per number card, keeps a pair of a value
  // from flipping to the same thing.
  const pickDark = (n: NumberValue, slot: 0 | 1): NumberValue => {
    const offset = slot === 0 ? 3 : 7;
    const next = (Number(n) + offset) % 10;
    return String(next) as NumberValue;
  };

  for (const color of COLORS) {
    addDual(color, "0", pickDark("0", 0));
    for (const n of NUMBERS.slice(1)) {
      addDual(color, n, pickDark(n, 0));
      addDual(color, n, pickDark(n, 1));
    }
    // Light actions pair with harsher dark actions.
    for (let i = 0; i < 2; i++) {
      addDual(color, "skip", "skip_all");
      addDual(color, "reverse", "reverse");
      addDual(color, "draw2", "draw5");
      addDual(color, "flip", "flip"); // flip is its own mirror
    }
  }
  // Wilds: light Wild ↔ dark Wild Draw 4 (stand-in for "Wild Draw Color").
  for (let i = 0; i < 4; i++) {
    addDual(null, "wild", "wild_draw4");
    addDual(null, "wild_draw4", "wild"); // reverse pairing
  }

  return cards;
}

export type Rng = () => number;

/** Fisher–Yates shuffle returning a new array. */
export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Standard UNO point value of a card, used for targetScore scoring. */
export function cardPoints(card: Card): number {
  switch (card.value) {
    case "skip":
    case "skip_all":
    case "reverse":
    case "draw2":
    case "draw5":
    case "flip":
      return 20;
    case "wild":
    case "wild_draw4":
      return 50;
    default:
      return Number(card.value);
  }
}
