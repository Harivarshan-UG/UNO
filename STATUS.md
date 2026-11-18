# Chaos Cards — fork status

Forked from [Uno-Groovy](https://github.com/Crisiswastaken/Uno-Groovy) (MIT).
Target: multiplayer UNO with Classic / No Mercy / Flip variants, up to 10
players, rich animations, audio toggle, free hosting.

## Done (session 5 — flip variant, chat, audio modal, deploy, animation keyframes)

Massive multi-feature session. Everything below shipped at once.

**Flip variant — engine complete**
- `src/engine/types.ts` — `Value` extended with `flip`, `draw5`, `skip_all`
  (FlipValue group). `Card.darkSide?: Card` for the dual-sided deck.
- `src/engine/deck.ts` — new `buildFlipDeck()` producing dual-sided cards
  with flip cards added, plus harsher dark-side actions.
  `cardPoints` handles the new action values.
- `src/engine/rules.ts` — new `faceOf(card, flipSide)` helper;
  `isPlayableNormally`, `canContinueStack`, `canPlay` all read the active
  face so hands work on either side. `+5` chains onto `+5` when same-rank
  stacking is on.
- `src/engine/engine.ts` — `startRound` uses `buildFlipDeck` when
  `flipMode` is on, buries flip + wild as openers, reads face values in
  the play effect switch. New card handlers: `flip` toggles
  `state.flipSide` and re-reads active color through the new face;
  `draw5` stacks 5 per card; `skip_all` advances `n` seats (back to self).
  `describeCard`/`rankLabel` updated.
- `engine.test.ts` — 3 new tests: Flip deck shape, `flip` card toggles
  side, `skip_all` returns play to the actor.

**Lobby preset badge**
- `src/components/Lobby.tsx` — `PresetBadge` chip above the room code.
  Empty seats now count against `view.config.maxPlayers` instead of a
  hardcoded 4.

**Chat**
- `src/engine/types.ts` — `ChatMessage` type and `chatLog` on
  `RoomState`/`ClientView`.
- `src/engine/engine.ts` — `postChat(state, playerId, text)` trims, caps at
  200 chars, keeps a rolling 100-message tail.
- `src/shared/protocol.ts` — new `chat { text }` client message.
- `server/index.ts` — dispatches `chat` into `postChat`.
- `src/components/ChatPanel.tsx` — new text chat component rendered in the
  Lobby. Auto-scrolls when the user is near the bottom; preserves scroll
  otherwise.
- `src/components/Lobby.tsx` — mounts `ChatPanel` below the Start button.

**Audio settings modal**
- `src/lib/provider.tsx` — provider now exposes `setVolume`; both `muted`
  and `volume` persist to localStorage.
- `src/components/SettingsModal.tsx` — new overlay with a sound on/off
  switch, volume slider, and a motion-reduction status note.
- `src/components/MuteToggle.tsx` — the speaker button now opens the modal
  (left-click) while right-click / long-press still toggles mute directly.

**Deployment (Fly.io + Cloudflare Pages)**
- `Dockerfile` — multi-stage Alpine image running the server via `tsx`,
  non-root, exposes 1999.
- `fly.toml` — small-vm config with `auto_stop_machines` and
  `min_machines_running = 0` so the free allowance easily covers casual use.
- `.dockerignore` — trims the build context.
- `DEPLOY-FREE.md` — step-by-step for Fly.io + Cloudflare Pages.
  Existing `render.yaml` is left in place as the upstream default.

**Animation toolkit (keyframes ready, wiring pending)**
- `src/app/globals.css` — new keyframes + utility classes:
  `wild-burst`, `plus-slam`, `flip-wave`, `reverse-swirl`. Available for
  wiring from the `cardFlight` layer or `useGameSounds` in a follow-up.

## Done (session 4 — 10-player mobile seat layout)

- `src/components/MobileGameTable.tsx`
  - New `sideCounts(n)` distributes opponents across left / top / right for
    1 through 9 opponents. Up to 2 per side for crowded tables; the rest flow
    across the top.
  - Top row becomes a horizontal `flex-wrap` strip when there are 2+ top
    seats (single-top case keeps the centred pointer layout).
  - New `compact` prop on `MobileSeat` + new `CompactTopSeat` component.
    Crowded top seats collapse to avatar + count badge + short name, so a
    10-player table still fits on a 360px phone.
- Engine is already N-agnostic (verified in `engine.ts`); no engine changes
  needed for the count lift.
- **Desktop (`GameTable.tsx`) still caps at ~4 seats** — frozen per
  CLAUDE.md §3, pending explicit user approval to edit.

## Done (session 3 — seven-swap picker UI)

- `src/components/SevenSwapPicker.tsx` — new overlay dialog. Shown whenever
  `view.pendingSevenSwap` is set for the local player. Lists every other
  seat with avatar + name + card count; click sends
  `chooseSevenSwapTarget`. Blocks interaction with the table beneath.
- `src/components/RoomClient.tsx` — mounts `<SevenSwapPicker />` inside the
  `in_round` branch so one overlay serves both desktop and mobile tables
  (neither `GameTable.tsx` nor `MobileGameTable.tsx` needed changes).
- `src/app/globals.css` — added `@keyframes seven-swap-fade` and
  `@keyframes seven-swap-pop` for the overlay entrance (per CLAUDE.md §5
  — extending the existing keyframe system, no Framer Motion).

## Done (session 2 — lobby preset UI)

- `src/app/create/page.tsx` — new `PresetRow` with Classic / No Mercy / Flip /
  Custom buttons; picking one writes the preset's full flag bundle. Touching
  any individual flag flips `preset` to `"custom"` automatically. Added
  **Max players (2–10)**, **7-swap**, and **0-rotate** toggle/number cards.

## Done (session 1 — engine foundation)

**Engine foundation** — `src/engine/`

- `types.ts` — `RuleConfig` extended with `preset`, `maxPlayers`, `sevenSwap`,
  `zeroRotate`, `flipMode`. `RoomState` + `ClientView` extended with
  `pendingSevenSwap` and `flipSide`.
- `engine.ts`
  - Player cap moved from hard-coded 4 to `config.maxPlayers` (clamped 2–10).
  - `playCards` now handles `"0"` (0-rotate) and `"7"` (seven-swap) effects
    behind their config flags. Stacked 7s skip the swap prompt (design note
    inline).
  - New `chooseSevenSwapTarget(state, playerId, targetSeat)` exported.
  - New private `rotateAllHands` helper, respects direction of play.
  - `autoPass` resolves a stuck seven-swap by picking a random opponent.
  - `drawCard` rejects while a seven-swap is pending.
  - `startRound` / `createRoom` initialize the new fields.
- `presets.ts` — new file. Exports `CLASSIC`, `NO_MERCY`, `FLIP` config bundles
  and a `presetConfig(name)` lookup. `NO_MERCY` is the aggressive bundle
  (stacking + chain + draw-until-playable + force-play + 7-0 + deal 10 +
  UNO penalty 4).
- `index.ts` — re-exports presets.
- `engine.test.ts` — new blocks: `maxPlayers` (3 cases), `7-swap rule`
  (6 cases), `0-rotate rule` (2 cases), `presets` (4 cases).

**Transport** — `src/shared/protocol.ts`

- Zod `ruleConfigSchema` extended with `preset`, `maxPlayers`, `sevenSwap`,
  `zeroRotate`, `flipMode` (with safe defaults for backwards compatibility).
- New client message `chooseSevenSwapTarget { targetSeat }`.

**Server** — `server/index.ts`

- Imports `chooseSevenSwapTarget` from the engine.
- Handles the new `chooseSevenSwapTarget` message in the dispatcher.

## Prerequisites to continue

Node 20+ is NOT installed on this machine. Install it with
`winget install OpenJS.NodeJS.LTS`, then:

```
cd C:\Users\Admin\projects\chaos-cards
npm install
npm test             # verify the new engine tests pass
npm run dev          # Next.js on 3000, WS on 1999
```

Open two browser tabs at `http://localhost:3000` and play a test round.

## Not yet done — next sessions

### 1. Lobby preset badge (small)
- `src/app/create/page.tsx` — DONE (session 2).
- `src/components/Lobby.tsx` — still TODO: show the active preset as a badge
  on the room screen so non-hosts know what variant they joined.

### 2. UI for 10 players
- `src/components/GameTable.tsx` (DESKTOP, frozen — needs explicit approval per
  `CLAUDE.md` §3). Current layout tops out at 4 seats.
- `src/components/MobileGameTable.tsx` (mobile). Needs seat positioning for
  2 / 3 / 4 / 6 / 8 / 10 counts; opponent cards scale down above 6.
- Both tables duplicate game logic verbatim — apply changes to both.

### 3. Seven-swap picker UI
- On the local client's turn when `view.pendingSevenSwap` is set, show a
  modal/overlay listing other seats; clicking one sends
  `{ type: "chooseSevenSwapTarget", targetSeat }`.
- Add a short animation: card hop + arrow from your hand to the picked seat.

### 4. Flip variant (significant)
- `src/engine/deck.ts` — new `buildFlipDeck()` producing 112 dual-sided
  cards. Each `Card` carries a `darkSide: Card` (own color + value).
- `src/engine/types.ts` — add `"flip"` to `Value`, dark-only values
  (`"draw5"`, `"skipAll"`).
- `src/engine/engine.ts` — handling for `"flip"` card: toggle
  `state.flipSide`, swap each hand/discard/draw card to its other face.
- Client rendering: when `flipSide === "dark"`, use the dark-side value
  and dark palette for every card.
- Table-flip animation (CSS keyframe wave across the table).
- New card art for dark side (PNG, 660×1029).

### 5. Chat + emotes
- Add `chat { text }` and `emote { kind }` client messages.
- Add `chatLog: Message[]` to `RoomState` (last 50), include in `ClientView`.
- `src/components/Lobby.tsx` + both tables: a collapsible chat panel and
  6 quick emotes that pop over avatars.

### 6. Animation enrichments (no Framer Motion per CLAUDE.md)
- Add keyframes to `src/app/globals.css`:
  - `wild-burst` — color-wheel ring expanding from played wild
  - `plus-slam` — screen pulse + hand shake on +2 / +4 (target seat)
  - `flip-wave` — 180° table flip for Flip card
  - `reverse-swirl` — direction arrows spin and reverse
- Wire into `src/components/cardFlight.tsx` and `useFlights`.

### 7. Audio additions
- Extend `src/hooks/useGameSounds.ts` with new SFX hooks (slam, flip, uno
  voice, color-pick chime, winner jingle, button clicks).
- Settings modal with master / SFX / music volume sliders, saved to
  `localStorage`. `MuteToggle` becomes a button that opens the modal.
- Background music: lobby loop + game loop. Autoplay only after first gesture.

### 8. Card art
- Repo ships `/public/cards/*.png`, "groovy" hand-drawn style, license MIT.
  Decide: reskin (new palette/style) or keep as-is. If renamed project is
  `chaos-cards`, retheming the art is natural.
- Flip variant needs a dark-side set.

### 9. Deployment (free hosting)
- The repo currently targets Render (free tier). Switch to:
  - WS server → Fly.io (small-vm, free allowance). Dockerfile + `fly.toml`.
  - Frontend → Cloudflare Pages (unlimited). Env var
    `NEXT_PUBLIC_PARTYKIT_HOST` → the Fly host.
- Or, since `partykit.json` is still in the repo, deploy the party server
  variant to Cloudflare Workers (`npm run deploy:party`) — note CLAUDE.md
  §6 flags `party/server.ts` as diverged from `server/index.ts`. Reconcile
  before using it.

## Open questions for the user

1. Project final name — "Chaos Cards" is a placeholder. The repo's Node
   package is still `"custom-uno"`. Rename `package.json` and the Next.js
   metadata when the name is picked.
2. Keep the existing "groovy" card art, or reskin for a new vibe?
3. Deployment target — Fly.io + Cloudflare Pages, or PartyKit all-in-one?
4. Which variants ship in v1? Currently: Classic + No Mercy (fully supported
   by engine) and Flip (scaffold only — client/engine work remaining).
