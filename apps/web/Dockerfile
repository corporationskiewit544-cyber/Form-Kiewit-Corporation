# --- build stage ---------------------------------------------------------
FROM oven/bun:1.3 AS build
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
RUN bun install --frozen-lockfile

COPY tsconfig.json tsconfig.json
COPY apps/web ./apps/web
RUN cd apps/web && bun run build

# --- runtime stage (nginx serves the SPA and proxies /api) ---------------
FROM nginx:alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
