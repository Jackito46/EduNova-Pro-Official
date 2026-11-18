# Multi-stage Dockerfile pour EduNova Pro (Production)
FROM node:22-alpine AS builder

WORKDIR /app

# Copie des manifestes de dépendances
COPY package*.json ./

# Installation propre des dépendances
RUN npm ci --legacy-peer-deps

# Copie du code source complet
COPY . .

# Construction des assets frontend avec Vite
RUN npm run build

# Stage d'exécution (Runtime allégé)
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copie des fichiers nécessaires depuis le builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/server ./server
COPY --from=builder /app/services ./services
COPY --from=builder /app/utils ./utils
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/index.html ./index.html
COPY --from=builder /app/sql ./sql

RUN mkdir -p /app/backups

# Port unique d'écoute (Interface + API + Proxy LAN /local-supabase)
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Démarrage du serveur Full-Stack Express + SPA
CMD ["npx", "tsx", "server.ts"]

