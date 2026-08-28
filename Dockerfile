# Full-Stack Node Application for EduNova Pro
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Build Vite client and Express server bundle
RUN npm run build

# Production Environment Settings
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Start compiled server
CMD ["node", "dist/server.cjs"]
