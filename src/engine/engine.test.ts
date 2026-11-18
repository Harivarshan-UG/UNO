import { describe, expect, it } from "vitest";
import { buildDeck, buildFlipDeck, cardPoints } from "./deck";
import { canPlay, canContinueStack } from "./rules";
import {
  addPlayer,
  autoPass,
  chooseSevenSwapTarget,
  createRoom,
  drawCard,
  playCard,
  playCards,
  startRound,
} from "./engine";
import { CLASSIC, NO_MERCY, FLIP, presetConfig } from "./presets";
import { Card, DEFAULT_CONFIG, RoomState, RuleConfig } from "./types";

function room(config: Partial<RuleConfig> = {}): RoomState {
  const s = createRoom("TEST", { ...DEFAULT_CONFIG, ...config });
  addPlayer(s, "p1", "Alice");
  addPlayer(s, "p2", "Bob");
  return s;
}

/** Force a deterministic board: give p1 a specific hand and a known discard. */
function setup(s: RoomState, top: Card, p1Hand: Card[], activeColor = top.color) {
  s.phase = "in_round";
  s.discardPile = [top];
  s.activeColor = activeColor;
  s.currentSeat = 0;
  s.pendingDraw = 0;
  s.pendingPass = null;
  s.drawPile = buildDeck();
  s.players[0].hand = p1Hand;
  s.players[1].hand = [c("blue", "0")];
}

let uid = 0;
const c = (color: Card["color"], value: Card["value"]): Card => ({
  uid: `u${uid++}`,
  color,
  value,
});

describe("deck", () => {
  it("builds a standard 108-card deck", () => {
    const deck = buildDeck();
    expect(deck.length).toBe(108);
    expect(deck.filter((x) => x.value === "wild").length).toBe(4);
    expect(deck.filter((x) => x.value === "wild_draw4").length).toBe(4);
    expect(deck.filter((x) => x.value === "0").length).toBe(4);
    expect(deck.filter((x) => x.value === "5").length).toBe(8);
  });

  it("scores cards per standard values", () => {
    expect(cardPoints(c("red", "7"))).toBe(7);
    expect(cardPoints(c("red", "skip"))).toBe(20);
    expect(cardPoints(c(null, "wild"))).toBe(50);
  });
});

describe("playability", () => {
  const cfg = DEFAULT_CONFIG;
  it("matches by color, value, and wilds", () => {
    const top = c("red", "5");
    const base = { activeColor: "red" as const, discardTop: top, pendingDraw: 0, config: cfg };
    expect(canPlay(c("red", "9"), base)).toBe(true); // color
    expect(canPlay(c("blue", "5"), base)).toBe(true); // value
    expect(canPlay(c(null, "wild"), base)).toBe(true); // wild
    expect(canPlay(c("blue", "9"), base)).toBe(false); // neither
  });

  it("forbids +2 onto +4 always", () => {
    const on = { ...DEFAULT_CONFIG, stackDraw2OnDraw2: true, stackDraw4OnDraw2Or4: true };
    expect(canContinueStack(c("red", "draw2"), "wild_draw4", on)).toBe(false);
    expect(canContinueStack(c(null, "wild_draw4"), "wild_draw4", on)).toBe(true);
  });
});

describe("turn flow", () => {
  it("advances to the next player on a number card", () => {
    const s = room();
    setup(s, c("red", "5"), [c("red", "7"), c("blue", "2")]);
    const uidPlay = s.players[0].hand[0].uid;
    const r = playCard(s, "p1", uidPlay);
    expect(r.ok).toBe(true);
    expect(s.currentSeat).toBe(1);
    expect(s.players[0].hand.length).toBe(1);
  });

  it("skip skips the next player (2p -> same player)", () => {
    const s = room();
    setup(s, c("red", "5"), [c("red", "skip"), c("red", "1")]);
    const skip = s.players[0].hand[0].uid;
    playCard(s, "p1", skip);
    expect(s.currentSeat).toBe(0); // opponent skipped, back to p1
  });

  it("draw2 accumulates a pending stack for the next player", () => {
    const s = room();
    setup(s, c("red", "5"), [c("red", "draw2"), c("red", "1")]);
    playCard(s, "p1", s.players[0].hand[0].uid);
    expect(s.pendingDraw).toBe(2);
    expect(s.currentSeat).toBe(1);
  });

  it("facing a stack, drawing takes the penalty and passes the turn", () => {
    const s = room();
    setup(s, c("red", "5"), [c("red", "draw2"), c("red", "1")]);
    playCard(s, "p1", s.players[0].hand[0].uid);
    const before = s.players[1].hand.length;
    drawCard(s, "p2");
    expect(s.players[1].hand.length).toBe(before + 2);
    expect(s.pendingDraw).toBe(0);
    expect(s.currentSeat).toBe(0);
  });
});

describe("uno + scoring", () => {
  it("marks a player catchable when reaching 1 card without calling", () => {
    const s = room({ unoCall: true });
    setup(s, c("red", "5"), [c("red", "7"), c("red", "1")]);
    playCard(s, "p1", s.players[0].hand[0].uid);
    expect(s.players[0].hand.length).toBe(1);
    expect(s.unoVulnerableSeat).toBe(0);
  });

  it("single round ends when a hand empties", () => {
    const s = room({ scoringMode: "singleRound" });
    setup(s, c("red", "5"), [c("red", "7")]);
    playCard(s, "p1", s.players[0].hand[0].uid);
    expect(s.phase).toBe("round_end");
    expect(s.roundWinnerId).toBe("p1");
  });
});

describe("stacking", () => {
  function room3(config: Partial<RuleConfig> = {}): RoomState {
    const s = createRoom("T3", { ...DEFAULT_CONFIG, ...config });
    addPlayer(s, "p1", "Alice");
    addPlayer(s, "p2", "Bob");
    addPlayer(s, "p3", "Cara");
    return s;
  }

  it("plays several same-rank cards (any color) in one turn when enabled", () => {
    const s = room({ stacking: true });
    setup(s, c("green", "5"), [c("red", "5"), c("blue", "5"), c("red", "8")]);
    const uids = [s.players[0].hand[0].uid, s.players[0].hand[1].uid];
    const r = playCards(s, "p1", uids);
    expect(r.ok).toBe(true);
    expect(s.players[0].hand.length).toBe(1);
    expect(s.currentSeat).toBe(1);
    expect(s.activeColor).toBe("blue"); // the last card sets the color
  });

  it("rejects multi-card plays when stacking is off", () => {
    const s = room({ stacking: false });
    setup(s, c("green", "5"), [c("red", "5"), c("blue", "5")]);
    const uids = s.players[0].hand.map((h) => h.uid);
    expect(playCards(s, "p1", uids).ok).toBe(false);
  });

  it("rejects a stack of mismatched ranks", () => {
    const s = room({ stacking: true });
    setup(s, c("green", "5"), [c("red", "5"), c("red", "8")]);
    const uids = s.players[0].hand.map((h) => h.uid);
    expect(playCards(s, "p1", uids).ok).toBe(false);
  });

  it("accumulates +2 draw penalties across a stack", () => {
    const s = room({ stacking: true });
    setup(s, c("red", "5"), [c("red", "draw2"), c("blue", "draw2"), c("red", "1")]);
    const uids = [s.players[0].hand[0].uid, s.players[0].hand[1].uid];
    playCards(s, "p1", uids);
    expect(s.pendingDraw).toBe(4);
    expect(s.currentSeat).toBe(1);
  });

  it("plays two Wild +4s as one stack, taking a single chosen color", () => {
    const s = room({ stacking: true });
    setup(s, c("red", "3"), [c(null, "wild_draw4"), c(null, "wild_draw4"), c("green", "9")]);
    const uids = [s.players[0].hand[0].uid, s.players[0].hand[1].uid];
    const r = playCards(s, "p1", uids, "blue");
    expect(r.ok).toBe(true);
    expect(s.pendingDraw).toBe(8); // 4 per card
    expect(s.activeColor).toBe("blue");
    expect(s.players[0].hand.length).toBe(1);
  });

  it("plays two Wilds as one stack", () => {
    const s = room({ stacking: true });
    setup(s, c("red", "3"), [c(null, "wild"), c(null, "wild"), c("green", "9")]);
    const uids = [s.players[0].hand[0].uid, s.players[0].hand[1].uid];
    expect(playCards(s, "p1", uids, "green").ok).toBe(true);
    expect(s.activeColor).toBe("green");
    expect(s.pendingDraw).toBe(0);
  });

  it("rejects a wild stack with no chosen color", () => {
    const s = room({ stacking: true });
    setup(s, c("red", "3"), [c(null, "wild_draw4"), c(null, "wild_draw4")]);
    const uids = s.players[0].hand.map((h) => h.uid);
    expect(playCards(s, "p1", uids).ok).toBe(false);
  });

  it("lets the +4 chain rule stack +4s even with the master toggle off", () => {
    const s = room({ stacking: false, stackDraw4OnDraw2Or4: true });
    setup(s, c("red", "3"), [c(null, "wild_draw4"), c(null, "wild_draw4"), c("red", "1")]);
    const uids = s.players[0].hand.slice(0, 2).map((h) => h.uid);
    expect(playCards(s, "p1", uids, "red").ok).toBe(true);
    expect(s.pendingDraw).toBe(8);
  });

  it("still rejects a wild stack when no rule allows it", () => {
    const s = room({ stacking: false, stackDraw4OnDraw2Or4: false });
    setup(s, c("red", "3"), [c(null, "wild_draw4"), c(null, "wild_draw4")]);
    const uids = s.players[0].hand.map((h) => h.uid);
    expect(playCards(s, "p1", uids, "red").ok).toBe(false);
  });

  it("stacks two +4s onto a pending +4 when chaining is on", () => {
    const s = room({ stacking: true, stackDraw4OnDraw2Or4: true });
    setup(s, c(null, "wild_draw4"), [c(null, "wild_draw4"), c(null, "wild_draw4"), c("red", "1")]);
    s.pendingDraw = 4;
    const uids = s.players[0].hand.slice(0, 2).map((h) => h.uid);
    expect(playCards(s, "p1", uids, "yellow").ok).toBe(true);
    expect(s.pendingDraw).toBe(12); // 4 pending + 4 + 4
  });

  it("two skips skip two players", () => {
    const s = room3({ stacking: true });
    s.phase = "in_round";
    s.discardPile = [c("red", "5")];
    s.activeColor = "red";
    s.currentSeat = 0;
    s.pendingDraw = 0;
    s.pendingPass = null;
    s.drawPile = buildDeck();
    s.players[0].hand = [c("red", "skip"), c("blue", "skip"), c("red", "1")];
    s.players[1].hand = [c("green", "0")];
    s.players[2].hand = [c("green", "1")];
    playCards(s, "p1", [s.players[0].hand[0].uid, s.players[0].hand[1].uid]);
    // Skip p2 and p3 → back to p1.
    expect(s.currentSeat).toBe(0);
  });
});

describe("turn timeout (autoPass)", () => {
  it("auto-draws and passes a player who never acted, advancing the turn", () => {
    const s = room();
    setup(s, c("red", "5"), [c("blue", "9")]); // nothing playable on red
    const before = s.players[0].hand.length;
    const r = autoPass(s, "p1");
    expect(r.ok).toBe(true);
    expect(s.players[0].hand.length).toBe(before + 1); // drew one
    expect(s.currentSeat).toBe(1); // turn moved on
    expect(s.pendingPass).toBeNull();
  });

  it("advances a player who drew and then stalled (already has pendingPass)", () => {
    const s = room();
    setup(s, c("red", "5"), [c("blue", "9")]);
    drawCard(s, "p1"); // p1 draws → pendingPass, still their turn
    expect(s.pendingPass?.playerId).toBe("p1");
    expect(s.currentSeat).toBe(0);
    const r = autoPass(s, "p1");
    expect(r.ok).toBe(true);
    expect(s.pendingPass).toBeNull();
    expect(s.currentSeat).toBe(1); // no longer hangs on p1
  });

  it("takes the full penalty when timing out against a draw stack", () => {
    const s = room();
    setup(s, c("red", "5"), [c("red", "draw2"), c("blue", "9")]);
    playCard(s, "p1", s.players[0].hand[0].uid); // p1 plays +2, p2 faces stack
    expect(s.pendingDraw).toBe(2);
    const before = s.players[1].hand.length;
    autoPass(s, "p2");
    expect(s.players[1].hand.length).toBe(before + 2);
    expect(s.pendingDraw).toBe(0);
    expect(s.currentSeat).toBe(0);
  });
});

describe("maxPlayers", () => {
  it("defaults to 10 and accepts up to that many", () => {
    const s = createRoom("TEST", { ...DEFAULT_CONFIG });
    for (let i = 0; i < 10; i++) {
      const r = addPlayer(s, `p${i}`, `P${i}`);
      expect(r.ok).toBe(true);
    }
    const overflow = addPlayer(s, "p10", "P10");
    expect(overflow.ok).toBe(false);
  });

  it("honors a host-lowered cap", () => {
    const s = createRoom("TEST", { ...DEFAULT_CONFIG, maxPlayers: 3 });
    addPlayer(s, "p1", "A");
    addPlayer(s, "p2", "B");
    addPlayer(s, "p3", "C");
    const overflow = addPlayer(s, "p4", "D");
    expect(overflow.ok).toBe(false);
  });

  it("clamps absurd cap values to 10", () => {
    const s = createRoom("TEST", { ...DEFAULT_CONFIG, maxPlayers: 99 });
    for (let i = 0; i < 10; i++) addPlayer(s, `p${i}`, `P${i}`);
    expect(addPlayer(s, "p10", "P10").ok).toBe(false);
  });
});

describe("7-swap rule", () => {
  it("sets pendingSevenSwap when a 7 is played and swap is on", () => {
    const s = room({ sevenSwap: true });
    setup(s, c("red", "3"), [c("red", "7"), c("green", "8")]);
    const r = playCard(s, "p1", s.players[0].hand[0].uid);
    expect(r.ok).toBe(true);
    expect(s.pendingSevenSwap?.playerId).toBe("p1");
    expect(s.currentSeat).toBe(0);
  });

  it("does nothing special when sevenSwap is off", () => {
    const s = room({ sevenSwap: false });
    setup(s, c("red", "3"), [c("red", "7"), c("green", "8")]);
    playCard(s, "p1", s.players[0].hand[0].uid);
    expect(s.pendingSevenSwap).toBeNull();
    expect(s.currentSeat).toBe(1);
  });

  it("swaps hands and advances turn on target choice", () => {
    const s = room({ sevenSwap: true });
    const myHand = [c("red", "7"), c("blue", "4")];
    const theirHand = [c("green", "9"), c("green", "2"), c("yellow", "5")];
    setup(s, c("red", "3"), myHand);
    s.players[1].hand = theirHand;
    playCard(s, "p1", myHand[0].uid);

    const r = chooseSevenSwapTarget(s, "p1", 1);
    expect(r.ok).toBe(true);
    expect(s.players[0].hand.length).toBe(3);
    expect(s.players[1].hand.length).toBe(1);
    expect(s.pendingSevenSwap).toBeNull();
    expect(s.currentSeat).toBe(1);
  });

  it("rejects swap with self", () => {
    const s = room({ sevenSwap: true });
    setup(s, c("red", "3"), [c("red", "7")]);
    playCard(s, "p1", s.players[0].hand[0].uid);
    const r = chooseSevenSwapTarget(s, "p1", 0);
    expect(r.ok).toBe(false);
  });

  it("blocks draw while a swap is pending", () => {
    const s = room({ sevenSwap: true });
    setup(s, c("red", "3"), [c("red", "7"), c("blue", "4")]);
    playCard(s, "p1", s.players[0].hand[0].uid);
    const r = drawCard(s, "p1");
    expect(r.ok).toBe(false);
  });

  it("does NOT trigger swap when multiple 7s are stacked", () => {
    const s = room({ sevenSwap: true, stacking: true });
    const hand = [c("red", "7"), c("blue", "7"), c("green", "8")];
    setup(s, c("red", "3"), hand);
    const r = playCards(s, "p1", [hand[0].uid, hand[1].uid]);
    expect(r.ok).toBe(true);
    expect(s.pendingSevenSwap).toBeNull();
    expect(s.currentSeat).toBe(1);
  });
});

describe("0-rotate rule", () => {
  it("rotates hands when zeroRotate is on and direction is +1", () => {
    const s = createRoom("TEST", { ...DEFAULT_CONFIG, zeroRotate: true });
    addPlayer(s, "p1", "A");
    addPlayer(s, "p2", "B");
    addPlayer(s, "p3", "C");
    s.phase = "in_round";
    s.discardPile = [c("red", "3")];
    s.activeColor = "red";
    s.direction = 1;
    s.currentSeat = 0;
    s.drawPile = buildDeck();
    const zero = c("red", "0");
    const keeper = c("blue", "2");
    s.players[0].hand = [zero, keeper];
    s.players[1].hand = [c("blue", "9")];
    s.players[2].hand = [c("green", "4"), c("green", "5")];

    const r = playCard(s, "p1", zero.uid);
    expect(r.ok).toBe(true);
    // direction=+1: seat i receives the hand previously at seat (i-1 mod n).
    //   seat 0 ← seat 2's hand (2 cards)
    //   seat 1 ← seat 0's remaining hand ([keeper], 1 card)
    //   seat 2 ← seat 1's hand (1 card)
    expect(s.players[0].hand.length).toBe(2);
    expect(s.players[1].hand.length).toBe(1);
    expect(s.players[2].hand.length).toBe(1);
    expect(s.players[1].hand[0].uid).toBe(keeper.uid);
  });

  it("does nothing when zeroRotate is off", () => {
    const s = room({ zeroRotate: false });
    setup(s, c("red", "3"), [c("red", "0"), c("blue", "4")]);
    const otherBefore = s.players[1].hand.slice();
    playCard(s, "p1", s.players[0].hand[0].uid);
    expect(s.players[1].hand).toEqual(otherBefore);
  });
});

describe("presets", () => {
  it("CLASSIC leaves variant flags off", () => {
    expect(CLASSIC.stacking).toBe(false);
    expect(CLASSIC.sevenSwap).toBe(false);
    expect(CLASSIC.zeroRotate).toBe(false);
    expect(CLASSIC.flipMode).toBe(false);
  });

  it("NO_MERCY turns on the aggressive bundle", () => {
    expect(NO_MERCY.stacking).toBe(true);
    expect(NO_MERCY.stackDraw2OnDraw2).toBe(true);
    expect(NO_MERCY.stackDraw4OnDraw2Or4).toBe(true);
    expect(NO_MERCY.drawPenaltyBehavior).toBe("drawUntilPlayable");
    expect(NO_MERCY.forcePlay).toBe(true);
    expect(NO_MERCY.sevenSwap).toBe(true);
    expect(NO_MERCY.zeroRotate).toBe(true);
    expect(NO_MERCY.dealSize).toBe(10);
  });

  it("FLIP sets flipMode", () => {
    expect(FLIP.flipMode).toBe(true);
  });
});

describe("Flip deck + rules", () => {
  it("buildFlipDeck attaches a darkSide to every card and includes flip cards", () => {
    const deck = buildFlipDeck();
    expect(deck.length).toBeGreaterThan(108);
    expect(deck.every((c) => !!c.darkSide)).toBe(true);
    expect(deck.filter((c) => c.value === "flip").length).toBe(8);
  });

  it("playing a flip card toggles state.flipSide", () => {
    const s = createRoom("TEST", { ...DEFAULT_CONFIG, flipMode: true });
    addPlayer(s, "p1", "A");
    addPlayer(s, "p2", "B");
    s.phase = "in_round";
    s.discardPile = [c("red", "3")];
    s.activeColor = "red";
    s.direction = 1;
    s.currentSeat = 0;
    s.drawPile = buildDeck();
    const flipCard: Card = { uid: "flip1", color: "red", value: "flip" };
    s.players[0].hand = [flipCard, c("blue", "4")];
    expect(s.flipSide).toBe("light");
    const r = playCard(s, "p1", flipCard.uid);
    expect(r.ok).toBe(true);
    expect(s.flipSide).toBe("dark");
    // Advances one seat as normal.
    expect(s.currentSeat).toBe(1);
  });

  it("skip_all advances the turn all the way back to the player", () => {
    const s = createRoom("TEST", { ...DEFAULT_CONFIG, flipMode: true });
    addPlayer(s, "p1", "A");
    addPlayer(s, "p2", "B");
    addPlayer(s, "p3", "C");
    s.phase = "in_round";
    s.flipSide = "dark"; // simulate mid-round flip state
    s.discardPile = [c("red", "3")];
    s.activeColor = "red";
    s.direction = 1;
    s.currentSeat = 0;
    s.drawPile = buildDeck();
    const skipAll: Card = {
      uid: "sa1",
      color: "red",
      value: "skip_all",
    };
    s.players[0].hand = [skipAll, c("blue", "4")];
    const r = playCard(s, "p1", skipAll.uid);
    expect(r.ok).toBe(true);
    expect(s.currentSeat).toBe(0); // back to the player who played it
  });

  it("presetConfig falls back to CLASSIC for unknown/custom", () => {
    expect(presetConfig("custom").preset).toBe("classic");
    expect(presetConfig(undefined).preset).toBe("classic");
  });
});
