# syntax=docker/dockerfile:1
# ============================================================
# KUFIX — persistent Node.js production image
# This is the only supported deployment path (Option 2):
# a Node host / VPS / Railway / Fly.io / Render with a
# persistent filesystem for verification document uploads.
# ============================================================

FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV CI=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV CI=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Nothing to inject here — secrets come from runtime env, not build args.
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Install the libpq bindings and utilities used at runtime (pg), plus ca-certs for Paystack.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      tini \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle.config.json ./drizzle.config.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/src/db/schema.ts ./src/db/schema.ts
# Persistent volume target for verification document uploads.
RUN mkdir -p /app/private/uploads/verification \
    && chown -R node:node /app
USER node
EXPOSE 3000
# Healthcheck for every platform (Railway / Fly.io / Render / systemd / docker-compose).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["npm", "run", "start"]
