# --- build stage ---------------------------------------------------------
FROM oven/bun:1.3 AS build
WORKDIR /app

# Install deps using the workspace manifests (better layer caching).
COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
RUN bun install --frozen-lockfile

# Compile the server to plain JS.
COPY tsconfig.json tsconfig.json
COPY apps/server ./apps/server
RUN cd apps/server && bun run build

# --- runtime stage -------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app/apps/server
ENV NODE_ENV=production
ENV PORT=3001

# Bun keeps the package store at the repo root (/app/node_modules/.bun) and puts
# per-workspace symlinks in apps/server/node_modules — both are needed at runtime.
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/server/node_modules ./node_modules
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/server/package.json ./package.json

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-3001}/api/health" || exit 1

EXPOSE 3001
CMD ["node", "dist/index.js"]
