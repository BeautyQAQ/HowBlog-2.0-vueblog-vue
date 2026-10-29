# syntax=docker/dockerfile:1
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund
COPY . .
RUN npm test && npm run build

FROM nginx:stable-alpine
ENV HOW_BASE_UPSTREAM=http://host.docker.internal:9001 \
    HOW_ARTICLE_UPSTREAM=http://host.docker.internal:9004 \
    HOW_USER_UPSTREAM=http://host.docker.internal:9008 \
    NGINX_ENVSUBST_FILTER=^HOW_
COPY --chmod=755 docker/19-validate-upstreams.sh /docker-entrypoint.d/19-validate-upstreams.sh
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY docker/proxy-common.conf /etc/nginx/snippets/proxy-common.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
