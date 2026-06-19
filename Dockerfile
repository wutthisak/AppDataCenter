FROM node:24-bookworm-slim AS deps

WORKDIR /app
RUN for attempt in 1 2 3; do \
    apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && break; \
    if [ "$attempt" = "3" ]; then exit 1; fi; \
    sleep 5; \
  done
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund --fetch-retries=5 --fetch-retry-maxtimeout=120000

FROM node:24-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN for attempt in 1 2 3; do \
    apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && break; \
    if [ "$attempt" = "3" ]; then exit 1; fi; \
    sleep 5; \
  done
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN for attempt in 1 2 3; do npx prisma generate && break; \
  if [ "$attempt" = "3" ]; then exit 1; fi; \
  sleep 5; \
  done
RUN npm run build

FROM node:24-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN for attempt in 1 2 3; do \
    apt-get update \
    && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    openssl \
    wget \
    && rm -rf /var/lib/apt/lists/* \
    && break; \
    if [ "$attempt" = "3" ]; then exit 1; fi; \
    sleep 5; \
  done

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# RUN npx playwright install chromium

EXPOSE 3000

CMD ["npm", "run", "start"]
