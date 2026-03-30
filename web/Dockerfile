# Build context must be the repo root (docker compose sets this via context: .)
# so that the @convex alias (../convex) resolves correctly during build.

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# VITE_CONVEX_URL is baked into the JS bundle at build time.
# Pass it via docker-compose build args.
ARG VITE_CONVEX_URL=http://localhost:3210
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json pnpm-lock.yaml ./
COPY web/package.json web/
COPY convex/ convex/

# Install root deps (convex types etc.) then web deps separately.
# --no-frozen-lockfile needed because lockfile was generated on macOS
# and is missing Linux/musl optional binaries (e.g. @rollup/rollup-linux-arm64-musl).
RUN pnpm install --no-frozen-lockfile
RUN cd web && pnpm install --no-frozen-lockfile

# Copy source (node_modules excluded via .dockerignore)
COPY web/ web/

WORKDIR /app/web
RUN pnpm build

# ── Stage 2: serve ──────────────────────────────────────────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/web/dist /usr/share/nginx/html

# SPA fallback: all routes serve index.html
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80
