# ConnectBhai API: portable production image. Runs anywhere Docker runs (Railway, Render, Fly.io, ECS, a VPS...).
# Build:  docker build -t connectbhai-api .
# Run:    docker run --env-file .production.env -p 4000:4000 connectbhai-api
# On start it applies database migrations, loads reference data ONCE if the database is empty, then serves the API.

FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app
# prisma + ts-node are runtime dependencies on purpose: they run migrations and the first-time seed at start-up
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY prisma ./prisma
COPY scripts ./scripts
COPY tsconfig.json ./
RUN chown -R node:node /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "start:deploy"]
