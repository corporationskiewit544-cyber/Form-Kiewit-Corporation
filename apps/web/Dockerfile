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
ENV NGINX_API_URL=http://server:3001
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf.template
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -sq http://localhost/ || exit 1

CMD ["/bin/sh", "-c", "envsubst '${NGINX_API_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
