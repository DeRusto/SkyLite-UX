# syntax=docker/dockerfile:1

# Build stage
FROM --platform=$BUILDPLATFORM node:20 AS builder

# Set working directory
WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
COPY prisma ./prisma/

# Install system dependencies and npm packages
RUN apt-get update -y && apt-get install -y openssl && \
    npm ci && \
    rm -rf /var/lib/apt/lists/*

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:20-slim AS production

# Set environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update -y && apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

# Copy prisma directory for migrations
COPY prisma ./prisma/

# Copy package.json and package-lock.json to extract Prisma version
COPY package.json package-lock.json ./

# Install Prisma CLI at the exact version used during build
RUN PRISMA_VERSION=$(node -e "const lock = JSON.parse(require('fs').readFileSync('package-lock.json','utf8')); console.log((lock.packages && lock.packages['node_modules/prisma'] || lock.dependencies && lock.dependencies['prisma']).version)") && \
    npm install -g prisma@${PRISMA_VERSION} && \
    rm -f package.json package-lock.json && \
    rm -rf /root/.npm

# Copy built application from builder stage
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Expose the port the app runs on
EXPOSE 3000

# Healthcheck to verify the app is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "const http = require('http'); const req = http.request({hostname: 'localhost', port: 3000, path: '/', timeout: 5000}, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

# Initialize database and start application
CMD ["sh", "-c", "prisma migrate deploy && node .output/server/index.mjs"]
