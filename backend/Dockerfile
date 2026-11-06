# syntax=docker/dockerfile:1
# Стадія base: лише маніфести, щоб кешувати npm ci
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# Стадія dev: усі залежності + nodemon; вихідники монтуються з хоста (docker-compose.dev.yml)
FROM base AS dev
ENV NODE_ENV=development
RUN npm ci
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# Стадія production: лише runtime-залежності, non-root користувач
FROM base AS production
ENV NODE_ENV=production
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
USER node
EXPOSE 4000
CMD ["node", "src/server.js"]
