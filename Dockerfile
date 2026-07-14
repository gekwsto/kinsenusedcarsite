FROM node:20-bookworm-slim AS dependencies

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# Το prisma.config.ts απαιτεί DATABASE_URL ακόμη και στο generate.
ENV DATABASE_URL="postgresql://docker_build:docker_build@localhost:5432/docker_build?schema=public"

RUN npm ci


FROM dependencies AS builder

WORKDIR /app

COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Προσωρινές build-only τιμές. Αντικαθίστανται στο runtime από το .env.
ENV DATABASE_URL="postgresql://docker_build:docker_build@localhost:5432/docker_build?schema=public"
ENV AUTH_SECRET="docker-build-placeholder-secret"
ENV NEXTAUTH_SECRET="docker-build-placeholder-secret"
ENV AUTH_URL="http://localhost:3000"
ENV NEXTAUTH_URL="http://localhost:3000"

RUN npm run build


FROM node:20-bookworm-slim AS runner

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app /app

RUN mkdir -p /app/public/uploads \
    && chown -R node:node /app/public/uploads

USER node

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start -- -H 0.0.0.0"]
