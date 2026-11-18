// Pure game-model types shared by the engine, the PartyKit server, and the client.

export type Color = "red" | "yellow" | "green" | "blue";

export type NumberValue = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
export type ActionValue = "skip" | "reverse" | "draw2";
export type WildValue = "wild" | "wild_draw4";
/**
 * Flip-only card types. `flip` toggles the global side for every card in play.
 * `draw5` and `skip_all` are dark-side action values with no light-side
 * counterpart (they only appear when flipSide === "dark").
 */
export type FlipValue = "flip" | "draw5" | "skip_all";
export type Value = NumberValue | ActionValue | WildValue | FlipValue;

export const COLORS: Color[] = ["red", "yellow", "green", "blue"];

/**
 * A concrete card instance. `color` is null only for wild types. `darkSide`
 * holds the alternate face used in Flip mode — when `flipSide === "dark"`,
 * engine code reads `card.darkSide` in place of `card` itself. Classic/No
 * Mercy decks leave `darkSide` undefined.
 */
export interface Card {
  uid: string;
  color: Color | null;
  value: Value;
  darkSide?: Card;
}

export type Phase = "lobby" | "in_round" | "round_end" | "match_end";

/** Named ruleset preset. Purely a UI label — the underlying flags drive play. */
export type RulesetPreset = "classic" | "no_mercy" | "flip" | "custom";

export interface RuleConfig {
  /** UI label for the active rule bundle. Engine only reads the flags below. */
  preset: RulesetPreset;
  /**
   * Max seats a room accepts. Default 10. Host can lower this at room creation.
   */
  maxPlayers: number;
  unoCall: boolean;
  unoPenalty: number;
  stackDraw2OnDraw2: boolean;
  stackDraw4OnDraw2Or4: boolean;
  /**
   * Stacking: play several cards of the same rank (number or symbol) in a
   * single turn, regardless of their color — e.g. two 5s, or a red Skip and a
   * blue Skip together. Off by default.
   */
  stacking: boolean;
  drawPenaltyBehavior: "drawOneAndPass" | "drawUntilPlayable";
  forcePlay: boolean;
  dealSize: number;
  scoringMode: "singleRound" | "targetScore";
  targetScore: number;
  /**
   * 7-0 rules. When `sevenSwap` is on, playing a 7 lets the player swap hands
   * with another player of their choosing (prompted immediately after the play
   * lands). When `zeroRotate` is on, playing a 0 rotates every player's hand
   * in the current direction of play. Both flags are independent.
   */
  sevenSwap: boolean;
  zeroRotate: boolean;
  /**
   * Flip variant scaffold. When `flipMode` is on the deck ships with dual-sided
   * cards and a `flip` card type that toggles the global `flipSide`. Engine
   * logic for Flip is staged in a follow-up; today this flag is a UI contract
   * so the lobby can display the variant.
   */
  flipMode: boolean;
}

export const DEFAULT_CONFIG: RuleConfig = {
  preset: "classic",
  maxPlayers: 10,
  unoCall: true,
  unoPenalty: 2,
  stackDraw2OnDraw2: false,
  stackDraw4OnDraw2Or4: false,
  stacking: false,
  drawPenaltyBehavior: "drawOneAndPass",
  forcePlay: false,
  dealSize: 7,
  scoringMode: "singleRound",
  targetScore: 500,
  sevenSwap: false,
  zeroRotate: false,
  flipMode: false,
};

export interface Player {
  playerId: string;
  displayName: string;
  seat: number;
  hand: Card[]; // private — never sent to other clients
  hasCalledUno: boolean;
  connected: boolean;
  /** Avatar id (0-7) the player picked on the NameGate; falls back to seat. */
  avatarId?: number;
}

export interface ActionLogEntry {
  id: string;
  text: string;
  seat: number | null;
}

/** A chat message posted by a player. Short, bounded in the room state. */
export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number; // epoch ms
}

/**
 * Set when the current player has drawn on a normal (non-stack) turn and must
 * now either play the drawn card or explicitly pass.
 */
export interface PendingPass {
  playerId: string;
  drawnUids: string[];
  mustPlay: boolean; // forcePlay + drawn card is playable
}

export interface RoomState {
  roomCode: string;
  hostPlayerId: string | null;
  config: RuleConfig;
  phase: Phase;
  players: Player[]; // seat order
  drawPile: Card[];
  discardPile: Card[];
  activeColor: Color | null;
  direction: 1 | -1;
  currentSeat: number;
  pendingDraw: number;
  pendingPass: PendingPass | null;
  /**
   * Set when a 7 was just played under `sevenSwap`; blocks the next turn
   * until the player picks a seat to swap hands with.
   */
  pendingSevenSwap: { playerId: string } | null;
  /**
   * Current side for Flip mode. `"light"` is the standard face; `"dark"` is
   * the harsher face used after a Flip card lands. Always `"light"` for
   * non-Flip rooms.
   */
  flipSide: "light" | "dark";
  /**
   * Epoch-ms deadline by which the current player must act before the server
   * auto-passes their turn, or null when no round is in progress. Set by the
   * transport (server), read into the client view for the countdown timer.
   */
  turnDeadline: number | null;
  /** Seat that is currently catchable for a missed UNO call, or null. */
  unoVulnerableSeat: number | null;
  scores: Record<string, number>;
  roundWinnerId: string | null;
  matchWinnerId: string | null;
  lastActionLog: ActionLogEntry[];
  /** Rolling tail of recent chat messages, oldest first. Capped server-side. */
  chatLog: ChatMessage[];
}

/** The personalized, public-safe snapshot a single client receives. */
export interface ClientView {
  roomCode: string;
  youPlayerId: string;
  hostPlayerId: string | null;
  config: RuleConfig;
  phase: Phase;
  players: {
    playerId: string;
    displayName: string;
    seat: number;
    handCount: number;
    hasCalledUno: boolean;
    connected: boolean;
    isCatchable: boolean;
    avatarId?: number;
  }[];
  yourHand: Card[];
  drawPileCount: number;
  discardTop: Card | null;
  /**
   * The last few cards on the discard pile, oldest first, top card last. Used to
   * fan the recently played cards under the top card so their colors remain
   * visible (e.g. a blue 4 peeking out beneath a red 4).
   */
  recentDiscard: Card[];
  activeColor: Color | null;
  direction: 1 | -1;
  currentSeat: number;
  pendingDraw: number;
  pendingPass: PendingPass | null;
  /**
   * When the local player owes a seven-swap target pick, their playerId; else
   * null. The client should prompt them to choose a seat.
   */
  pendingSevenSwap: { playerId: string } | null;
  flipSide: "light" | "dark";
  /** Epoch-ms deadline for the current turn, or null. Drives the countdown. */
  turnEndsAt: number | null;
  scores: Record<string, number>;
  roundWinnerId: string | null;
  matchWinnerId: string | null;
  lastActionLog: ActionLogEntry[];
  chatLog: ChatMessage[];
}
