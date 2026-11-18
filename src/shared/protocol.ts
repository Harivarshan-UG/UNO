import { z } from "zod";

// ---------------------------------------------------------------------------
// Rule config schema (validated when a host creates a room)
// ---------------------------------------------------------------------------

export const ruleConfigSchema = z.object({
  preset: z.enum(["classic", "no_mercy", "flip", "custom"]).default("classic"),
  maxPlayers: z.number().int().min(2).max(10).default(10),
  unoCall: z.boolean(),
  unoPenalty: z.number().int().min(1).max(10),
  stackDraw2OnDraw2: z.boolean(),
  stackDraw4OnDraw2Or4: z.boolean(),
  stacking: z.boolean(),
  drawPenaltyBehavior: z.enum(["drawOneAndPass", "drawUntilPlayable"]),
  forcePlay: z.boolean(),
  dealSize: z.number().int().min(3).max(10),
  scoringMode: z.enum(["singleRound", "targetScore"]),
  targetScore: z.number().int().min(100).max(2000),
  sevenSwap: z.boolean().default(false),
  zeroRotate: z.boolean().default(false),
  flipMode: z.boolean().default(false),
});

const colorSchema = z.enum(["red", "yellow", "green", "blue"]);

// ---------------------------------------------------------------------------
// Client -> server messages
// ---------------------------------------------------------------------------

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("joinRoom"),
    playerId: z.string().min(1),
    displayName: z.string().min(1).max(20),
    config: ruleConfigSchema.optional(), // only honored by the room creator
  }),
  z.object({ type: z.literal("rejoin"), playerId: z.string().min(1) }),
  z.object({ type: z.literal("setConfig"), config: ruleConfigSchema }),
  z.object({ type: z.literal("startGame") }),
  z.object({
    type: z.literal("playCard"),
    uid: z.string(),
    chosenColor: colorSchema.optional(),
  }),
  z.object({
    type: z.literal("playCards"),
    uids: z.array(z.string()).min(1).max(10),
    chosenColor: colorSchema.optional(),
  }),
  z.object({ type: z.literal("drawCard") }),
  z.object({ type: z.literal("passAfterDraw") }),
  z.object({ type: z.literal("callUno") }),
  z.object({ type: z.literal("catchMissedUno"), targetPlayerId: z.string() }),
  z.object({
    type: z.literal("chooseSevenSwapTarget"),
    targetSeat: z.number().int().min(0).max(9),
  }),
  z.object({ type: z.literal("startNextRound") }),
  z.object({ type: z.literal("leaveRoom") }),
  z.object({ type: z.literal("chat"), text: z.string().min(1).max(200) }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ---------------------------------------------------------------------------
// Server -> client messages
// ---------------------------------------------------------------------------

export type ServerMessage =
  | { type: "stateUpdate"; view: import("../engine/types").ClientView }
  | { type: "invalidAction"; reason: string }
  | { type: "joined"; playerId: string }
  | { type: "error"; reason: string };
