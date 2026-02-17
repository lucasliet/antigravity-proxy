# Dockerfile for Antigravity Claude Proxy
# Multi-stage build for optimized production image

# Stage 1: Build dependencies
FROM node:24-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for CSS build)
# Ignore scripts to prevent 'prepare' from failing due to missing source files
RUN npm ci --ignore-scripts

# Copy source code
COPY . .

# Build CSS (requires devDependencies)
RUN npm run build:css

# Stage 2: Production image
FROM node:24-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    tini \
    curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
# Ignore scripts to prevent 'prepare' (which needs devDeps) from failing
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy built assets from builder
COPY --from=builder /app/public/css/style.css /app/public/css/style.css

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create directories for runtime data
RUN mkdir -p /app/.config/antigravity-proxy && \
    chown -R nodejs:nodejs /app/.config

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start server
CMD ["node", "src/index.js"]
