// Named ruleset bundles. The engine itself only reads the flag combinations;
// these presets exist so the lobby can offer one-click variants without
// juggling the full flag grid.

import { DEFAULT_CONFIG, RuleConfig, RulesetPreset } from "./types";

/**
 * Classic UNO. The "Mattel" baseline — no stacking, no 7-0, no force-play.
 * UNO calls are enforced with a 2-card penalty on a successful catch.
 */
export const CLASSIC: RuleConfig = {
  ...DEFAULT_CONFIG,
  preset: "classic",
};

/**
 * No Mercy. The aggressive house-rules bundle: +2/+4 chain, draw-until-playable,
 * same-rank stacking, force-play on the drawn card, 7-swap and 0-rotate both on.
 * Larger starting hand (10) because turns move much faster.
 */
export const NO_MERCY: RuleConfig = {
  ...DEFAULT_CONFIG,
  preset: "no_mercy",
  stackDraw2OnDraw2: true,
  stackDraw4OnDraw2Or4: true,
  stacking: true,
  drawPenaltyBehavior: "drawUntilPlayable",
  forcePlay: true,
  sevenSwap: true,
  zeroRotate: true,
  dealSize: 10,
  unoPenalty: 4,
};

/**
 * Flip. Dual-sided deck with a global light/dark state. Engine logic for the
 * flip card is staged separately — this preset sets the flag so the lobby can
 * display the variant and the client can start rendering dark-side art.
 */
export const FLIP: RuleConfig = {
  ...DEFAULT_CONFIG,
  preset: "flip",
  flipMode: true,
  stacking: false,
};

export const PRESETS: Record<Exclude<RulesetPreset, "custom">, RuleConfig> = {
  classic: CLASSIC,
  no_mercy: NO_MERCY,
  flip: FLIP,
};

/** Look up a preset by name. Returns `CLASSIC` for unknown or "custom". */
export function presetConfig(name: RulesetPreset | undefined): RuleConfig {
  if (!name || name === "custom") return CLASSIC;
  return PRESETS[name] ?? CLASSIC;
}
