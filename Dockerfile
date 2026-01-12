# Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Production image
FROM node:20-alpine
WORKDIR /app

# Install build dependencies for native modules (ssh2) and openssl for SSL
RUN apk add --no-cache python3 make g++ openssl

# Install backend dependencies
COPY backend/package*.json ./
RUN npm install --production && npm cache clean --force

# Remove build dependencies to reduce image size (keep openssl)
RUN apk del python3 make g++

# Copy backend
COPY backend/server.js ./

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./public

# Create data directories
RUN mkdir -p /app/data/icons /app/data/ssh_keys /app/data/ssl

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HTTPS_PORT=3443

EXPOSE 3000 3443

# Volume for persistent data
VOLUME ["/app/data"]

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
