import { Card, Color, RuleConfig, Value } from "./types";

export const isWild = (v: Value) => v === "wild" || v === "wild_draw4";
export const isDrawCard = (v: Value) =>
  v === "draw2" || v === "draw5" || v === "wild_draw4";

/**
 * Resolve a card to the face that is currently in play. In Flip mode on the
 * dark side, a card is read through its `darkSide` back. Classic/No Mercy
 * rounds have `flipSide === "light"` and `darkSide === undefined`, so this is
 * a no-op there.
 */
export function faceOf(card: Card, flipSide: "light" | "dark" = "light"): Card {
  if (flipSide === "dark" && card.darkSide) return card.darkSide;
  return card;
}

/**
 * Can `card` legally be played given the active color and the discard top,
 * ignoring any pending draw stack (that is handled by `legalPlaysForStack`).
 */
export function isPlayableNormally(
  card: Card,
  activeColor: Color | null,
  discardTop: Card | null,
  flipSide: "light" | "dark" = "light",
): boolean {
  const c = faceOf(card, flipSide);
  const top = discardTop ? faceOf(discardTop, flipSide) : null;
  if (isWild(c.value)) return true; // wilds are always playable (§4.1.2)
  if (!top) return true;
  if (c.color === activeColor) return true;
  if (c.value === top.value) return true;
  // Flip cards can always chain onto a flip card regardless of color — their
  // whole point is the global toggle.
  if (c.value === "flip" && top.value === "flip") return true;
  return false;
}

/**
 * When a draw stack is active (pendingDraw > 0), only certain draw cards may be
 * played to continue the stack. Returns whether `card` is a legal continuation.
 *
 * Legal transitions (only when the matching toggle is on):
 *   draw2 -> draw2         (stackDraw2OnDraw2)
 *   draw2 -> wild_draw4    (stackDraw4OnDraw2Or4)
 *   wild_draw4 -> wild_draw4 (stackDraw4OnDraw2Or4)
 *   wild_draw4 -> draw2    NEVER (hard constraint §4.1.6 / §4.3)
 */
export function canContinueStack(
  card: Card,
  topDrawValue: Value,
  config: RuleConfig,
): boolean {
  if (!isDrawCard(card.value)) return false;

  if (topDrawValue === "draw2") {
    if (card.value === "draw2") return config.stackDraw2OnDraw2;
    if (card.value === "wild_draw4") return config.stackDraw4OnDraw2Or4;
  }
  if (topDrawValue === "wild_draw4") {
    if (card.value === "wild_draw4") return config.stackDraw4OnDraw2Or4;
    if (card.value === "draw2") return false; // +2 onto +4 forbidden always
  }
  // Flip-mode: +5 chains onto +5 when the same-rank chain toggle is on.
  if (topDrawValue === "draw5") {
    if (card.value === "draw5") return config.stackDraw2OnDraw2;
  }
  return false;
}

/**
 * Whether several cards of the same rank may be played in one turn.
 *
 * The master `stacking` toggle covers every rank, including wilds — two Wild +4s
 * are a legal same-rank stack exactly like two red 5s. The two draw-chain
 * toggles additionally imply same-turn stacking for the rank they name: a table
 * that allows a +4 to be chained onto a +4 across turns has no reason to forbid
 * a player from firing both of theirs at once, and players consistently read
 * those toggles as "+4s stack". Everything else needs the master toggle.
 */
export function canStackRank(value: Value, config: RuleConfig): boolean {
  if (config.stacking) return true;
  if (value === "draw2") return config.stackDraw2OnDraw2;
  if (value === "wild_draw4") return config.stackDraw4OnDraw2Or4;
  return false;
}

/**
 * Master playability check used for validation and for dimming cards in the UI.
 * Accounts for an active draw stack.
 */
export function canPlay(
  card: Card,
  opts: {
    activeColor: Color | null;
    discardTop: Card | null;
    pendingDraw: number;
    config: RuleConfig;
    flipSide?: "light" | "dark";
  },
): boolean {
  const { activeColor, discardTop, pendingDraw, config } = opts;
  const flipSide = opts.flipSide ?? "light";
  const activeFace = faceOf(card, flipSide);
  const topFace = discardTop ? faceOf(discardTop, flipSide) : null;
  if (pendingDraw > 0) {
    const topValue = topFace?.value;
    if (!topValue || !isDrawCard(topValue)) return false;
    return canContinueStack(activeFace, topValue, config);
  }
  return isPlayableNormally(card, activeColor, discardTop, flipSide);
}
