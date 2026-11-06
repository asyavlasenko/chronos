# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# Стадія dev: Vite dev-сервер з HMR; вихідники монтуються з хоста (docker-compose.dev.yml)
FROM base AS dev
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Стадія build: продакшн-збірка у /app/dist
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# Стадія production: nginx віддає статику і проксує /api на backend
FROM nginx:1.27-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://localhost/ > /dev/null || exit 1
