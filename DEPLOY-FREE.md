# Deploy for free — Fly.io + Cloudflare Pages

Two services, both free-tier friendly, no credit card required for Cloudflare.
Fly.io requires a card for identity but the small-vm + auto-stop config below
keeps you inside the free allowance.

The repo also still ships `render.yaml` (the upstream project's Render config)
and `partykit.json` (Cloudflare Workers via PartyKit). This file documents the
Fly + Pages combo that was added for Chaos Cards.

## 1. Game server → Fly.io

```bash
# One-time
curl -L https://fly.io/install.sh | sh    # or `brew install flyctl`
fly auth signup                            # or `fly auth login`

# From the repo root
fly launch --no-deploy                     # picks a unique app name; edit fly.toml accordingly
fly deploy
```

The config (`fly.toml`) sets `auto_stop_machines = true` and
`min_machines_running = 0`, so the VM suspends when nobody's playing and wakes
on the next socket. The client already handles the ~15s cold-start with a
"Waking the game server…" message (`src/hooks/useRoom.ts`).

After deploy, note the hostname — e.g. `chaos-cards-server.fly.dev`.

## 2. Frontend → Cloudflare Pages

Easiest path (via the Cloudflare dashboard):

1. Push this repo to GitHub.
2. Cloudflare dashboard → Pages → **Create a project** → **Connect to Git**.
3. Build settings:
   - Framework preset: **Next.js**
   - Build command: `npm run build`
   - Build output directory: `.next`
   - Root directory: *(leave empty)*
4. Environment variables (Production + Preview):
   - `NEXT_PUBLIC_PARTYKIT_HOST` = `chaos-cards-server.fly.dev` *(from step 1 — no scheme, no trailing slash)*
   - `NODE_VERSION` = `22`

Alternative (CLI):

```bash
npx wrangler pages deploy .next --project-name chaos-cards
```

## 3. Smoke test

- Open `https://<your-pages-domain>` in a browser tab.
- Create a room, copy the invite link, open it in a second tab (or another
  device over the same URL).
- Play a round. The first interaction after an idle period will show the
  wake-up message for ~15s.

## 4. Updating

- Server: `fly deploy` from your checkout.
- Frontend: push to the branch Pages is tracking (default: `main`). Pages
  auto-deploys on push.

## 5. Costs you might hit

- Fly.io: machine time inside the free allowance for a small-vm (256 MB).
  Idle → suspended, so a game that runs an hour a day stays comfortably free.
- Cloudflare Pages: 500 builds/month free, unlimited bandwidth, unlimited
  requests. You will not come anywhere near those.
