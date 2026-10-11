FROM node:24-slim

ENV NODE_ENV=development
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund

COPY --chown=node:node . .
# Prisma Client generation does not need a live database, but Prisma's config
# expects a URL to be present at build time.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" npx prisma generate \
  && npm cache clean --force \
  && chown -R node:node /app

ENV NODE_ENV=production
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["sh", "-c", "npm run db:migrate:deploy && npm start"]
