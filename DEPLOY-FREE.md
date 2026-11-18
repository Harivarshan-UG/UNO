# Deploy for free — Render + Cloudflare Pages

Two services, both **actually free** with no credit card / no trial clock.
This supersedes an earlier version of this doc that recommended Fly.io —
Fly's free tier was replaced in 2025 with a $5 / 7-day trial, so it is no
longer free after one week. Render's free tier is still real.

The repo also ships `Dockerfile` + `fly.toml` for anyone who wants to pay
~$2–3/month on Fly.io for zero cold starts; see the "Paid alternative" section
at the bottom.

## 1. Game server → Render (free)

The project already ships `render.yaml` (a Render Blueprint). You don't need
to install anything locally — Render reads the Blueprint from your GitHub repo
and provisions everything.

1. Push your fork to GitHub (already done for this fork).
2. Open https://dashboard.render.com and sign in (free, GitHub OAuth is easiest).
3. **New +** → **Blueprint**.
4. Pick your repo (`Harivarshan-UG/UNO`). Render reads `render.yaml` and shows
   the service it will create (`custom-uno-server`, free plan, Node).
5. **Apply**. First build takes ~2 minutes.
6. Note the service URL — e.g. `custom-uno-server.onrender.com`. **No scheme,
   no trailing slash** when you use this below.

**About the cold start.** Render's free tier suspends the server after 15 min
of no traffic. First visitor after a lull waits ~30s for a container boot. The
project handles this on purpose — `src/hooks/useRoom.ts` polls `/health` and
`src/components/RoomClient.tsx` shows a "Waking the game server…" card with the
elapsed time while you wait. Casual games are fine; anyone keeping a tab open
keeps the server warm.

## 2. Frontend → Cloudflare Pages (free)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages**
   → **Connect to Git**.
2. Pick your repo.
3. Build settings:
   - **Framework preset:** Next.js
   - **Build command:** `npm run build`
   - **Build output directory:** `.next`
   - **Root directory:** *(empty)*
4. Environment variables (Production **and** Preview):
   - `NEXT_PUBLIC_PARTYKIT_HOST` = `custom-uno-server.onrender.com`
     *(your Render URL host — no scheme, no trailing slash)*
   - `NODE_VERSION` = `22`
5. **Save and Deploy**. First build takes ~2 minutes.

You'll get a URL like `chaos-cards.pages.dev`. That's your game.

## 3. Smoke test

- Open the Pages URL in one tab.
- Create a room, copy the invite, open it in a second tab (or send to a
  phone over the same URL).
- Play a round. The first interaction after an idle period will show the
  wake-up message for ~30s — expected on the free tier.

## 4. Updating

- Server: push to `main`. Render auto-deploys on push.
- Frontend: push to `main`. Cloudflare Pages auto-deploys on push.

## 5. Paid alternative — Fly.io (~$2–3 / month)

Pick this only if the Render cold-start annoys you enough to pay to kill it.
The repo ships `Dockerfile` + `fly.toml` configured for a 256 MB shared VM
with `auto_stop_machines = true` (suspend when idle, wake on first socket).

```bash
curl -L https://fly.io/install.sh | sh   # or `winget install Fly-io.flyctl`
fly auth signup                           # $5 trial / 7 days free, then pays-as-you-go
fly launch --no-deploy                    # pick a unique app name; edit fly.toml accordingly
fly deploy
```

Point Cloudflare Pages' `NEXT_PUBLIC_PARTYKIT_HOST` at the Fly hostname
(`<app>.fly.dev`) instead of the Render one.

Fly will still cold-start occasionally with the stop-when-idle config, but a
lot faster than Render (~1s vs ~30s). To avoid cold starts entirely, set
`min_machines_running = 1` — that's roughly $3/month for a 256 MB VM.

## 6. If Render is full or you want always-on + free

**Koyeb** (https://koyeb.com) offers one always-on "Nano" service free per
account. It can run the same Dockerfile. Trade-off: one free slot, so you
can't run multiple free apps per account.
