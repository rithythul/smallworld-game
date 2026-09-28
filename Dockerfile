# Small World: the game files and the multiplayer server in one small container.
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

# Install dependencies first so Docker can reuse this layer when only game files change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

# Saves, towns and the leaderboard live in /data. Mount a volume there to keep them across redeploys.
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1

CMD ["node", "server.js"]
