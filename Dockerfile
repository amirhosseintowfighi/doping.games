# Doping web front end: build with Node, serve the static files with nginx.
#   docker build -t doping-web .
#   docker run -p 8080:80 doping-web            → http://localhost:8080
# The container listens on $PORT (default 80), so it also fits platforms that assign the port.

# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
# Use a mirror when the build server cannot reach the public npm registry:
#   docker build --build-arg NPM_REGISTRY=https://<mirror>/ -t doping-web .
ARG NPM_REGISTRY=https://registry.npmjs.org/
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --registry="$NPM_REGISTRY"
COPY . .
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
ENV PORT=80
# Files in /etc/nginx/templates get ${PORT} substituted at container start.
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
