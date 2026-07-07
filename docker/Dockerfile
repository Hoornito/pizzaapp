# ─── Base ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
# `npm install` (no `npm ci`) porque el lockfile del monorepo vive en la raíz,
# no en apps/web (que es el contexto de build). apps/web/package.json ya lista
# todas las dependencias, así que la instalación es completa igual.
# `--legacy-peer-deps`: next-auth v5 beta declara un peer de nodemailer@7 que
# choca con el nodemailer@6 del proyecto; sin el flag, npm aborta por ERESOLVE.
RUN npm install --legacy-peer-deps

# ─── Development ──────────────────────────────────────────────────────────────
FROM base AS development
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ─── Builder ──────────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Production ───────────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# El server custom (server.ts) NO usa el output "standalone": corre con tsx y en
# tiempo de ejecución importa el código de src/ (socket-server, servicios) y usa
# el tsconfig para resolver los alias '@/'. Por eso copiamos la app construida
# COMPLETA (incluye .next, src, server.ts, tsconfig, prisma y node_modules).
COPY --from=builder /app ./

EXPOSE 3000

# npm run start = "NODE_ENV=production tsx server.ts"
CMD ["npm", "run", "start"]
