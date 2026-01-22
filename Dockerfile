# Build stage for frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install build dependencies for native modules (ssh2) and openssl for SSL
RUN apk add --no-cache python3 make g++ openssl

# Install backend dependencies
COPY backend/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Remove build dependencies to reduce image size (keep openssl)
RUN apk del python3 make g++

# Copy backend code
COPY backend/ ./

# Copy built frontend to backend's public folder
COPY --from=frontend-builder /build/frontend/dist ./public

# Create data directories
RUN mkdir -p /app/data/icons /app/data/ssh_keys /app/data/ssl

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HTTPS_PORT=3443
ENV DATA_DIR=/app/data

# Expose ports
EXPOSE 3000 3443

# Volume for persistent data
VOLUME ["/app/data"]

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/ping || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
