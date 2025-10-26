# =============================================================================
# Multi-stage Dockerfile for Gateway API
# =============================================================================
# Stage 1: Build - Compile TypeScript and generate Prisma Client
# =============================================================================
FROM node:20-alpine AS builder

# Install dependencies required for native modules
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma Client
RUN pnpm prisma:generate

# Build TypeScript
RUN pnpm build

# Verify build output
RUN ls -la /app && ls -la /app/dist

# =============================================================================
# Stage 2: Runtime - Lightweight production image
# =============================================================================
FROM node:20-alpine AS runner

# Install dependencies required for native modules and OpenSSL for Prisma
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 gateway

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Copy node_modules from builder (includes generated Prisma Client)
COPY --from=builder /app/node_modules ./node_modules

# Copy prisma schema
COPY --from=builder /app/prisma ./prisma

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Verify dist folder exists and set ownership
RUN ls -la /app/dist && chown -R gateway:nodejs /app

# Switch to non-root user
USER gateway

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["node", "dist/index.js"]

