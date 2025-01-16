# ===== Builder Stage =====
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /usr/src/app

# Install build essentials and security tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    git \
    && rm -rf /var/cache/apk/*

# Copy package files with strict permissions
COPY --chown=node:node package*.json ./
COPY --chown=node:node tsconfig.json ./

# Install dependencies including devDependencies
RUN npm ci && \
    # Run security audit
    npm audit && \
    # Clean npm cache
    npm cache clean --force

# Copy source code and config files
COPY --chown=node:node . .

# Build TypeScript code with optimizations
RUN npm run build && \
    # Clean up build artifacts and devDependencies
    npm prune --production && \
    rm -rf src/ tests/ coverage/ .git/

# ===== Production Stage =====
FROM node:20-alpine

# Set working directory
WORKDIR /usr/src/app

# Create non-root user
RUN addgroup -g 1000 nodeapp && \
    adduser -u 1000 -G nodeapp -s /bin/sh -D nodeapp

# Install production dependencies
RUN apk add --no-cache \
    curl \
    tini \
    && rm -rf /var/cache/apk/*

# Set environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV TZ=UTC

# Copy package files and install production dependencies
COPY --chown=nodeapp:nodeapp package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built files from builder stage
COPY --chown=nodeapp:nodeapp --from=builder /usr/src/app/dist ./dist
COPY --chown=nodeapp:nodeapp --from=builder /usr/src/app/node_modules ./node_modules

# Security hardening
RUN chmod -R 550 . && \
    chmod -R 770 node_modules && \
    # Ensure correct ownership
    chown -R nodeapp:nodeapp .

# Configure resource limits
RUN echo "nodeapp soft nofile 1000" >> /etc/security/limits.conf && \
    echo "nodeapp hard nofile 1000" >> /etc/security/limits.conf && \
    echo "nodeapp soft nproc 50" >> /etc/security/limits.conf && \
    echo "nodeapp hard nproc 50" >> /etc/security/limits.conf

# Set up health checks
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Container metadata
LABEL org.opencontainers.image.source="https://github.com/organization/prompts-portal" \
    org.opencontainers.image.version="${VERSION}" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    com.prompts-portal.service.name="backend" \
    com.prompts-portal.service.version="${VERSION}"

# Expose service ports
EXPOSE 3000 3001 3002 3003

# Set user
USER nodeapp

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start command with clustering enabled
CMD ["node", "--max-old-space-size=2048", "--expose-gc", "dist/index.js"]