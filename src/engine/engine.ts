import { nanoid } from "nanoid";
import { buildDeck, buildFlipDeck, cardPoints, shuffle } from "./deck";
import {
  canPlay,
  canStackRank,
  faceOf,
  isPlayableNormally,
  isWild,
} from "./rules";
import {
  ActionLogEntry,
  Card,
  ClientView,
  Color,
  Player,
  RoomState,
  RuleConfig,
  DEFAULT_CONFIG,
} from "./types";

export type Result = { ok: true } | { ok: false; reason: string };
const ok: Result = { ok: true };
const fail = (reason: string): Result => ({ ok: false, reason });

// ---------------------------------------------------------------------------
// Room / player lifecycle
// ---------------------------------------------------------------------------

export function createRoom(roomCode: string, config: RuleConfig): RoomState {
  return {
    roomCode,
    hostPlayerId: null,
    config,
    phase: "lobby",
    players: [],
    drawPile: [],
    discardPile: [],
    activeColor: null,
    direction: 1,
    currentSeat: 0,
    pendingDraw: 0,
    pendingPass: null,
    pendingSevenSwap: null,
    flipSide: "light",
    turnDeadline: null,
    unoVulnerableSeat: null,
    scores: {},
    roundWinnerId: null,
    matchWinnerId: null,
    lastActionLog: [],
    chatLog: [],
  };
}

/**
 * Post a chat message from a seated player. Trims whitespace, enforces a
 * length cap, and keeps only the most recent 100 messages on the room state
 * so a long-running room doesn't grow unbounded.
 */
export function postChat(
  state: RoomState,
  playerId: string,
  text: string,
): Result {
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) return fail("Not in this room");
  const clean = text.trim().slice(0, 200);
  if (!clean) return fail("Empty message");
  const entry = {
    id: nanoid(8),
    playerId,
    name: player.displayName,
    text: clean,
    at: Date.now(),
  };
  state.chatLog = [...state.chatLog.slice(-99), entry];
  return ok;
}

export function addPlayer(
  state: RoomState,
  playerId: string,
  displayName: string,
  avatarId?: number,
): Result {
  if (state.phase !== "lobby") return fail("Game already started");
  const cap = Math.min(Math.max(state.config.maxPlayers ?? 10, 2), 10);
  if (state.players.length >= cap) return fail("Room is full");
  if (state.players.some((p) => p.playerId === playerId)) {
    // Returning player — let them refresh their avatar pick.
    if (typeof avatarId === "number") {
      const p = state.players.find((x) => x.playerId === playerId)!;
      p.avatarId = clampAvatar(avatarId);
    }
    return ok;
  }

  const seat = state.players.length;
  state.players.push({
    playerId,
    displayName: displayName.slice(0, 20) || `Player ${seat + 1}`,
    seat,
    hand: [],
    hasCalledUno: false,
    connected: true,
    avatarId: typeof avatarId === "number" ? clampAvatar(avatarId) : undefined,
  });
  state.scores[playerId] ??= 0;
  if (!state.hostPlayerId) state.hostPlayerId = playerId;
  log(state, `${displayName} joined`, seat);
  return ok;
}

/** Remove a player. In lobby this frees + re-seats; in game the seat is held. */
export function removePlayer(state: RoomState, playerId: string): void {
  const p = state.players.find((x) => x.playerId === playerId);
  if (!p) return;

  if (state.phase === "lobby") {
    state.players = state.players.filter((x) => x.playerId !== playerId);
    state.players.forEach((pl, i) => (pl.seat = i));
    delete state.scores[playerId];
  } else {
    p.connected = false;
  }

  if (state.hostPlayerId === playerId) {
    const next = state.players.find((x) => x.connected) ?? state.players[0];
    state.hostPlayerId = next ? next.playerId : null;
  }
}

export function setConnected(state: RoomState, playerId: string, connected: boolean) {
  const p = state.players.find((x) => x.playerId === playerId);
  if (p) p.connected = connected;
}

// ---------------------------------------------------------------------------
// Round setup
// ---------------------------------------------------------------------------

export function startRound(state: RoomState): Result {
  if (state.players.length < 2) return fail("Need at least 2 players");

  const deck = shuffle(
    state.config.flipMode ? buildFlipDeck() : buildDeck(),
  );
  state.players.forEach((p) => {
    p.hand = [];
    p.hasCalledUno = false;
  });

  for (let i = 0; i < state.config.dealSize; i++) {
    for (const p of state.players) {
      const c = deck.pop();
      if (c) p.hand.push(c);
    }
  }

  // Flip first non-wild, non-flip card as the initial discard — a flip opener
  // would toggle the whole table before anyone acts, which no one expects.
  let first = deck.pop();
  while (first && (isWild(first.value) || first.value === "flip")) {
    deck.unshift(first);
    first = deck.pop();
  }
  if (!first) return fail("Deck error");

  state.drawPile = deck;
  state.discardPile = [first];
  state.activeColor = first.color;
  state.direction = 1;
  state.currentSeat = 0;
  state.pendingDraw = 0;
  state.pendingPass = null;
  state.pendingSevenSwap = null;
  state.flipSide = "light";
  state.unoVulnerableSeat = null;
  state.roundWinnerId = null;
  state.matchWinnerId = null;
  state.phase = "in_round";
  state.lastActionLog = [];
  log(state, "Round started", null);

  // Apply the first card's action effect against the opening player (feel-faithful).
  applyOpeningCardEffect(state, first);
  return ok;
}

function applyOpeningCardEffect(state: RoomState, first: Card) {
  const n = state.players.length;
  switch (first.value) {
    case "skip":
      state.currentSeat = mod(state.currentSeat + state.direction, n);
      break;
    case "reverse":
      state.direction = state.direction === 1 ? -1 : 1;
      state.currentSeat = mod(-1, n); // last seat opens when reversed
      break;
    case "draw2":
      state.pendingDraw = 2; // opener must respond to the stack
      break;
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Turn helpers
// ---------------------------------------------------------------------------

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Keep avatar ids inside the 0..7 range the client renders. */
const clampAvatar = (id: number) => Math.max(0, Math.min(7, Math.floor(id)));

function seatPlayer(state: RoomState, seat: number): Player | undefined {
  return state.players.find((p) => p.seat === seat);
}

function currentPlayer(state: RoomState): Player | undefined {
  return seatPlayer(state, state.currentSeat);
}

function advance(state: RoomState, steps = 1) {
  const n = state.players.length;
  state.currentSeat = mod(state.currentSeat + state.direction * steps, n);
}

function log(state: RoomState, text: string, seat: number | null) {
  const entry: ActionLogEntry = { id: nanoid(6), text, seat };
  state.lastActionLog = [...state.lastActionLog.slice(-19), entry];
}

/** Draw a single card, reshuffling the discard (minus its top) when empty. */
function drawFromPile(state: RoomState): Card | null {
  if (state.drawPile.length === 0) {
    if (state.discardPile.length <= 1) return null;
    const top = state.discardPile[state.discardPile.length - 1];
    const rest = state.discardPile.slice(0, -1);
    state.drawPile = shuffle(rest);
    state.discardPile = [top];
    log(state, "Draw pile reshuffled", null);
  }
  return state.drawPile.pop() ?? null;
}

function drawN(state: RoomState, player: Player, n: number): Card[] {
  const drawn: Card[] = [];
  for (let i = 0; i < n; i++) {
    const c = drawFromPile(state);
    if (!c) break;
    player.hand.push(c);
    drawn.push(c);
  }
  if (player.hand.length > 1) player.hasCalledUno = false;
  return drawn;
}

/** Clears the missed-UNO catch window; called at the start of every play/draw. */
function closeUnoWindow(state: RoomState) {
  state.unoVulnerableSeat = null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Play a single card. Thin wrapper over {@link playCards}. */
export function playCard(
  state: RoomState,
  playerId: string,
  uid: string,
  chosenColor?: Color,
): Result {
  return playCards(state, playerId, [uid], chosenColor);
}

/**
 * Play one or more cards in a single turn. With more than one card every card
 * must share the same rank (number or symbol) — their colors may differ — and a
 * house rule must allow that rank to stack (see {@link canStackRank}). Effects
 * accumulate: N +2s add 2N to the draw stack, N +4s add 4N, N skips skip N
 * players, an odd number of reverses flips direction. The last card played sets
 * the active color; for a stack of wilds that is the one `chosenColor` supplied
 * for the whole play, so the player is only asked to pick a color once.
 */
export function playCards(
  state: RoomState,
  playerId: string,
  uids: string[],
  chosenColor?: Color,
): Result {
  if (state.phase !== "in_round") return fail("Not in a round");
  const player = currentPlayer(state);
  if (!player || player.playerId !== playerId) return fail("Not your turn");
  if (uids.length === 0) return fail("No cards to play");

  const uidSet = new Set(uids);
  if (uidSet.size !== uids.length) return fail("Duplicate card");

  // Enforce forcePlay: if you drew and the drawn card is playable, the play
  // must include it.
  if (state.pendingPass && state.pendingPass.playerId === playerId && state.pendingPass.mustPlay) {
    if (!uids.some((u) => state.pendingPass!.drawnUids.includes(u))) {
      return fail("You must play the card you drew");
    }
  }

  const found = uids.map((u) => player.hand.find((c) => c.uid === u));
  if (found.some((c) => !c)) return fail("Card not in hand");
  const cards = found as Card[];

  // Multi-card play requires a shared rank and a rule that allows stacking it.
  // Wilds are not special-cased here: two Wild +4s share the rank "wild_draw4"
  // and stack like any other pair, taking a SINGLE chosen color for the whole
  // play (see the `chosenColor` check below).
  if (cards.length > 1) {
    const rank = cards[0].value;
    if (!cards.every((c) => c.value === rank)) {
      return fail("Stacked cards must be the same number or symbol");
    }
    if (!canStackRank(rank, state.config)) return fail("Stacking is off");
  }

  // At least one card must be a legal opener (respecting any pending stack).
  const opts = {
    activeColor: state.activeColor,
    discardTop: discardTop(state),
    pendingDraw: state.pendingDraw,
    config: state.config,
    flipSide: state.flipSide,
  };
  const openerIdx = cards.findIndex((c) => canPlay(c, opts));
  if (openerIdx === -1) return fail("Card is not playable");

  // Opener leads; the rest keep their order (the last card sets active color).
  const opener = cards[openerIdx];
  const ordered = [opener, ...cards.filter((_, i) => i !== openerIdx)];
  const finalCard = ordered[ordered.length - 1];
  // In Flip mode we care about the FACE values, not the raw card values; a
  // player's hand stores light-side cards but the dark-side value is what
  // currently matters. `value` is the shared rank of the stack, as faced.
  const openerFace = faceOf(opener, state.flipSide);
  const finalFace = faceOf(finalCard, state.flipSide);
  const value = openerFace.value;
  const count = ordered.length;

  if (isWild(finalFace.value) && !chosenColor) {
    return fail("Choose a color for the wild");
  }

  closeUnoWindow(state);
  state.pendingPass = null;

  // Move every played card to the discard, in order.
  player.hand = player.hand.filter((c) => !uidSet.has(c.uid));
  for (const c of ordered) state.discardPile.push(c);
  state.activeColor = isWild(finalFace.value) ? chosenColor! : finalFace.color;

  if (count > 1) {
    log(state, `${player.displayName} played ${count}× ${rankLabel(value)}`, player.seat);
  } else {
    log(state, `${player.displayName} played ${describeCard(finalFace, state.activeColor)}`, player.seat);
  }

  // Win check.
  if (player.hand.length === 0) {
    endRound(state, player);
    return ok;
  }

  // UNO vulnerability: reached 1 card without having called.
  if (player.hand.length === 1) {
    if (state.config.unoCall && !player.hasCalledUno) {
      state.unoVulnerableSeat = player.seat;
    }
  } else {
    player.hasCalledUno = false;
  }

  // Card effects, accumulated across the stack.
  const n = state.players.length;
  switch (value) {
    case "skip":
      log(state, count > 1 ? `${count} players skipped` : "Next player skipped", null);
      advance(state, 1 + count);
      break;
    case "skip_all":
      // Dark-side "skip everyone": the turn comes back around to you.
      log(state, "Everyone else skipped!", null);
      advance(state, n);
      break;
    case "reverse":
      if (count % 2 === 1) state.direction = state.direction === 1 ? -1 : 1;
      // An odd number of reverses acts as a skip in a 2-player game.
      if (n === 2 && count % 2 === 1) advance(state, 2);
      else advance(state, 1);
      break;
    case "draw2":
      state.pendingDraw += 2 * count;
      advance(state, 1);
      break;
    case "draw5":
      state.pendingDraw += 5 * count;
      advance(state, 1);
      break;
    case "wild_draw4":
      state.pendingDraw += 4 * count;
      advance(state, 1);
      break;
    case "flip":
      // Toggle the global side, then re-interpret the active color through
      // the new face of the card we just played.
      state.flipSide = state.flipSide === "light" ? "dark" : "light";
      log(state, `Flipped to ${state.flipSide} side!`, null);
      const newFinalFace = faceOf(finalCard, state.flipSide);
      state.activeColor = isWild(newFinalFace.value)
        ? chosenColor ?? state.activeColor
        : newFinalFace.color;
      advance(state, 1);
      break;
    case "0":
      if (state.config.zeroRotate) {
        rotateAllHands(state);
        log(state, "Hands rotated!", null);
      }
      advance(state, 1);
      break;
    case "7":
      // A single 7 under sevenSwap triggers a choose-target prompt. A stacked
      // play of multiple 7s is treated as a plain play — the UX of "pick N
      // targets" is complex and players generally expect the stack to just
      // clear cards.
      if (state.config.sevenSwap && count === 1) {
        state.pendingSevenSwap = { playerId: player.playerId };
        log(state, `${player.displayName} plays 7 — pick a seat to swap`, player.seat);
        // Intentionally do NOT advance — player must still act.
        return ok;
      }
      advance(state, 1);
      break;
    default:
      advance(state, 1);
      break;
  }
  return ok;
}

/**
 * Resolve a pending seven-swap: swap the active player's hand with the chosen
 * target seat, then advance the turn. Illegal if no swap is pending, if the
 * caller isn't the pending player, or if the target seat doesn't exist.
 */
export function chooseSevenSwapTarget(
  state: RoomState,
  playerId: string,
  targetSeat: number,
): Result {
  if (state.phase !== "in_round") return fail("Not in a round");
  if (!state.pendingSevenSwap || state.pendingSevenSwap.playerId !== playerId) {
    return fail("No pending swap");
  }
  const me = state.players.find((p) => p.playerId === playerId);
  const target = state.players.find((p) => p.seat === targetSeat);
  if (!me || !target) return fail("Unknown seat");
  if (target.playerId === playerId) return fail("Cannot swap with yourself");

  const tmp = me.hand;
  me.hand = target.hand;
  target.hand = tmp;
  // Swapping defeats a prior UNO call on either side.
  me.hasCalledUno = false;
  target.hasCalledUno = false;
  state.unoVulnerableSeat = null;

  log(state, `${me.displayName} swapped hands with ${target.displayName}`, me.seat);
  state.pendingSevenSwap = null;
  advance(state, 1);
  return ok;
}

/** 0-rotate: every hand moves one seat in the current direction of play. */
function rotateAllHands(state: RoomState): void {
  const n = state.players.length;
  if (n < 2) return;
  const bySeat = [...state.players].sort((a, b) => a.seat - b.seat);
  const hands = bySeat.map((p) => p.hand);
  const unos = bySeat.map((p) => p.hasCalledUno);
  for (let i = 0; i < n; i++) {
    const srcIdx = mod(i - state.direction, n);
    bySeat[i].hand = hands[srcIdx];
    bySeat[i].hasCalledUno = unos[srcIdx];
  }
  state.unoVulnerableSeat = null;
}

export function drawCard(state: RoomState, playerId: string): Result {
  if (state.phase !== "in_round") return fail("Not in a round");
  const player = currentPlayer(state);
  if (!player || player.playerId !== playerId) return fail("Not your turn");
  if (state.pendingSevenSwap && state.pendingSevenSwap.playerId === playerId) {
    return fail("Pick a seat to swap with first");
  }
  if (state.pendingPass && state.pendingPass.playerId === playerId) {
    return fail("You already drew — play or pass");
  }

  closeUnoWindow(state);

  // Facing a draw stack and not continuing it: take the whole penalty and lose turn.
  if (state.pendingDraw > 0) {
    const drawn = drawN(state, player, state.pendingDraw);
    log(state, `${player.displayName} drew ${drawn.length}`, player.seat);
    state.pendingDraw = 0;
    advance(state, 1);
    return ok;
  }

  // Normal draw.
  const drawn: Card[] = [];
  if (state.config.drawPenaltyBehavior === "drawUntilPlayable") {
    while (true) {
      const c = drawFromPile(state);
      if (!c) break;
      player.hand.push(c);
      drawn.push(c);
      if (isPlayableNormally(c, state.activeColor, discardTop(state), state.flipSide)) break;
    }
    if (player.hand.length > 1) player.hasCalledUno = false;
  } else {
    drawn.push(...drawN(state, player, 1));
  }

  log(state, `${player.displayName} drew ${drawn.length}`, player.seat);

  const drawnPlayable = drawn.some((c) =>
    isPlayableNormally(c, state.activeColor, discardTop(state), state.flipSide),
  );
  const mustPlay = state.config.forcePlay && drawnPlayable;
  state.pendingPass = {
    playerId,
    drawnUids: drawn.map((c) => c.uid),
    mustPlay,
  };
  return ok;
}

export function passAfterDraw(state: RoomState, playerId: string): Result {
  if (state.phase !== "in_round") return fail("Not in a round");
  const player = currentPlayer(state);
  if (!player || player.playerId !== playerId) return fail("Not your turn");
  if (!state.pendingPass || state.pendingPass.playerId !== playerId) {
    return fail("Nothing to pass");
  }
  if (state.pendingPass.mustPlay) return fail("You must play the card you drew");

  state.pendingPass = null;
  advance(state, 1);
  log(state, `${player.displayName} passed`, player.seat);
  return ok;
}

export function callUno(state: RoomState, playerId: string): Result {
  const player = state.players.find((p) => p.playerId === playerId);
  if (!player) return fail("Unknown player");
  if (player.hand.length > 2) return fail("Too many cards to call UNO");
  player.hasCalledUno = true;
  if (state.unoVulnerableSeat === player.seat) state.unoVulnerableSeat = null;
  log(state, `${player.displayName} called UNO!`, player.seat);
  return ok;
}

export function catchMissedUno(
  state: RoomState,
  callerId: string,
  targetPlayerId: string,
): Result {
  if (!state.config.unoCall) return fail("UNO calls are off");
  const target = state.players.find((p) => p.playerId === targetPlayerId);
  if (!target) return fail("Unknown player");
  if (
    target.hand.length !== 1 ||
    target.hasCalledUno ||
    state.unoVulnerableSeat !== target.seat
  ) {
    return fail("Nothing to catch");
  }
  drawN(state, target, state.config.unoPenalty);
  state.unoVulnerableSeat = null;
  log(state, `${target.displayName} was caught! +${state.config.unoPenalty}`, target.seat);
  return ok;
}

/**
 * Server-driven auto-move for a player who ran out of time — whether they never
 * acted or drew and then stalled. Always advances the turn so a round can never
 * hang on one seat.
 */
export function autoPass(state: RoomState, playerId: string): Result {
  if (state.phase !== "in_round") return fail("Not in a round");
  const player = currentPlayer(state);
  if (!player || player.playerId !== playerId) return fail("Not their turn");

  // Owes a seven-swap pick: pick a random opponent and resolve.
  if (state.pendingSevenSwap && state.pendingSevenSwap.playerId === playerId) {
    const others = state.players.filter((p) => p.playerId !== playerId);
    if (others.length === 0) {
      state.pendingSevenSwap = null;
      advance(state, 1);
      return ok;
    }
    const target = others[Math.floor(Math.random() * others.length)];
    return chooseSevenSwapTarget(state, playerId, target.seat);
  }

  // Already drew this turn: pass if allowed, else (forcePlay) auto-play the card.
  if (state.pendingPass && state.pendingPass.playerId === playerId) {
    if (!state.pendingPass.mustPlay) return passAfterDraw(state, playerId);
    return autoPlayForced(state, player);
  }

  if (state.pendingDraw > 0) {
    return drawCard(state, playerId);
  }
  const d = drawCard(state, playerId);
  if (!d.ok) return d;
  // forcePlay locked them into playing the drawn card — do it for them.
  if (state.pendingPass && state.pendingPass.mustPlay) return autoPlayForced(state, player);
  return passAfterDraw(state, playerId);
}

/** Play the first drawn-and-playable card on behalf of a timed-out player. */
function autoPlayForced(state: RoomState, player: Player): Result {
  const drawnUids = state.pendingPass?.drawnUids ?? [];
  const opts = {
    activeColor: state.activeColor,
    discardTop: discardTop(state),
    pendingDraw: state.pendingDraw,
    config: state.config,
    flipSide: state.flipSide,
  };
  const uid = drawnUids.find((u) => {
    const c = player.hand.find((x) => x.uid === u);
    return !!c && canPlay(c, opts);
  });
  if (!uid) {
    // Nothing playable after all — release the lock and move on.
    state.pendingPass = null;
    advance(state, 1);
    return ok;
  }
  const card = player.hand.find((x) => x.uid === uid)!;
  const face = faceOf(card, state.flipSide);
  const color = isWild(face.value) ? autoColorFor(player) : undefined;
  return playCards(state, player.playerId, [uid], color);
}

/** A sensible color for an auto-played wild: the player's most-held color. */
function autoColorFor(player: Player): Color {
  const counts: Record<Color, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const c of player.hand) if (c.color) counts[c.color]++;
  return (Object.keys(counts) as Color[]).reduce((a, b) => (counts[b] > counts[a] ? b : a), "red");
}

export function startNextRound(state: RoomState): Result {
  if (state.phase === "match_end") {
    // Fresh match: reset scores.
    Object.keys(state.scores).forEach((k) => (state.scores[k] = 0));
  } else if (state.phase !== "round_end") {
    return fail("Round not over");
  }
  return startRound(state);
}

// ---------------------------------------------------------------------------
// Round end / scoring
// ---------------------------------------------------------------------------

function endRound(state: RoomState, winner: Player) {
  state.roundWinnerId = winner.playerId;
  log(state, `${winner.displayName} emptied their hand!`, winner.seat);

  if (state.config.scoringMode === "targetScore") {
    const gained = state.players
      .filter((p) => p.playerId !== winner.playerId)
      .reduce((sum, p) => sum + p.hand.reduce((s, c) => s + cardPoints(c), 0), 0);
    state.scores[winner.playerId] = (state.scores[winner.playerId] ?? 0) + gained;
    log(state, `${winner.displayName} scored +${gained}`, winner.seat);

    if (state.scores[winner.playerId] >= state.config.targetScore) {
      state.matchWinnerId = winner.playerId;
      state.phase = "match_end";
    } else {
      state.phase = "round_end";
    }
  } else {
    state.matchWinnerId = winner.playerId;
    state.phase = "round_end";
  }
}

// ---------------------------------------------------------------------------
// Views & helpers
// ---------------------------------------------------------------------------

function discardTop(state: RoomState): Card | null {
  return state.discardPile[state.discardPile.length - 1] ?? null;
}

function describeCard(card: Card, activeColor: Color | null): string {
  if (card.value === "wild") return `Wild (${activeColor})`;
  if (card.value === "wild_draw4") return `Wild +4 (${activeColor})`;
  const label: Record<string, string> = {
    skip: "Skip",
    skip_all: "Skip-All",
    reverse: "Reverse",
    draw2: "+2",
    draw5: "+5",
    flip: "Flip",
  };
  return `${card.color} ${label[card.value] ?? card.value}`;
}

/** Colorless rank label used for stacked plays, e.g. "5", "Skip", "+2". */
function rankLabel(value: Card["value"]): string {
  const label: Record<string, string> = {
    skip: "Skip",
    skip_all: "Skip-All",
    reverse: "Reverse",
    draw2: "+2",
    draw5: "+5",
    flip: "Flip",
    wild: "Wild",
    wild_draw4: "Wild +4",
  };
  return label[value] ?? value;
}

/** Build the personalized, public-safe snapshot for one player. */
export function getClientView(state: RoomState, playerId: string): ClientView {
  const me = state.players.find((p) => p.playerId === playerId);
  return {
    roomCode: state.roomCode,
    youPlayerId: playerId,
    hostPlayerId: state.hostPlayerId,
    config: state.config,
    phase: state.phase,
    players: state.players.map((p) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      seat: p.seat,
      handCount: p.hand.length,
      hasCalledUno: p.hasCalledUno,
      connected: p.connected,
      isCatchable:
        state.config.unoCall &&
        state.unoVulnerableSeat === p.seat &&
        p.hand.length === 1 &&
        !p.hasCalledUno,
      avatarId: p.avatarId,
    })),
    yourHand: me ? me.hand : [],
    drawPileCount: state.drawPile.length,
    discardTop: discardTop(state),
    recentDiscard: state.discardPile.slice(-4),
    activeColor: state.activeColor,
    direction: state.direction,
    currentSeat: state.currentSeat,
    pendingDraw: state.pendingDraw,
    pendingPass:
      state.pendingPass && state.pendingPass.playerId === playerId
        ? state.pendingPass
        : null,
    pendingSevenSwap:
      state.pendingSevenSwap && state.pendingSevenSwap.playerId === playerId
        ? state.pendingSevenSwap
        : null,
    flipSide: state.flipSide,
    turnEndsAt: state.phase === "in_round" ? state.turnDeadline : null,
    scores: state.scores,
    roundWinnerId: state.roundWinnerId,
    matchWinnerId: state.matchWinnerId,
    lastActionLog: state.lastActionLog,
    chatLog: state.chatLog,
  };
}

export { DEFAULT_CONFIG };
