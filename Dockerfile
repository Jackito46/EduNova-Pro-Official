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
COPY --from=builder /app/services ./services
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/index.html ./index.html

# Port d'écoute pour Coolify / Traefik
EXPOSE 3000

# Démarrage du serveur Full-Stack Express + SPA
CMD ["npx", "tsx", "server.ts"]
