# Multi-stage build for the game WS server (server/index.ts).
# The frontend deploys separately (Cloudflare Pages / Vercel); this image only
# contains what the Node WebSocket backend needs at runtime.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Include dev deps so `tsx` is available at runtime (the server is run via tsx,
# not pre-compiled).
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=1999

COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY server ./server
COPY src ./src

# Fly.io passes PORT via env; the server already reads process.env.PORT.
EXPOSE 1999

# Non-root user for a smaller attack surface.
RUN addgroup -g 1001 -S node-app && adduser -S node-app -u 1001 -G node-app
USER node-app

CMD ["npx", "tsx", "server/index.ts"]
