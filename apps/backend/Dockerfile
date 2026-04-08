# ── Build Stage ──
FROM node:20-alpine AS build

# OpenSSL für Prisma Query Engine (libssl wird zur Laufzeit benötigt)
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

# ── Production Stage ──
FROM node:20-alpine AS production

# OpenSSL für Prisma Query Engine (libssl wird zur Laufzeit benötigt)
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/app.js"]
