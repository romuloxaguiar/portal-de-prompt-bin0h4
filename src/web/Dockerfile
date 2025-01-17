# Stage 1: Builder
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV NPM_CONFIG_AUDIT=true
ENV NPM_CONFIG_STRICT_SSL=true

# Install build dependencies and security tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    && rm -rf /var/cache/apk/*

# Copy package files with integrity verification
COPY package*.json ./
COPY --chown=node:node . .

# Install dependencies with security measures
RUN npm ci --production=false \
    && npm audit \
    && npm cache clean --force

# Build application with optimization flags
ARG API_BASE_URL
ARG BUILD_VERSION
ENV VITE_API_BASE_URL=${API_BASE_URL}
ENV VITE_BUILD_VERSION=${BUILD_VERSION}

RUN npm run build \
    && npm run typecheck \
    && npm run test

# Stage 2: Production
FROM nginx:1.25-alpine

# Add non-root user
RUN addgroup -g 101 -S nginx \
    && adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx nginx

# Copy Nginx configuration
COPY infrastructure/docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY infrastructure/docker/nginx/security-headers.conf /etc/nginx/security-headers.conf

# Copy built assets from builder
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Security hardening
RUN chmod -R 755 /usr/share/nginx/html \
    && chown -R nginx:nginx /usr/share/nginx/html \
    && chmod -R 755 /var/cache/nginx \
    && chown -R nginx:nginx /var/cache/nginx \
    && chmod -R 755 /var/log/nginx \
    && chown -R nginx:nginx /var/log/nginx \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid \
    && rm /etc/nginx/conf.d/default.conf

# Set resource limits
ENV NGINX_WORKER_PROCESSES=auto
ENV NGINX_WORKER_CONNECTIONS=1024
ENV NGINX_WORKER_RLIMIT_NOFILE=2048

# Configure healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/health || exit 1

# Set container labels
LABEL maintainer="Prompts Portal Team" \
    version="1.0.0" \
    description="Prompts Portal Web Frontend" \
    security.scanning="enabled" \
    monitoring.enabled="true"

# Expose port
EXPOSE 80

# Switch to non-root user
USER nginx

# Set security options
WORKDIR /usr/share/nginx/html
RUN chmod -R 555 .

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]

# Apply security configurations
STOPSIGNAL SIGQUIT