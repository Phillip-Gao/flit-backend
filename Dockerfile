# Stage 1: Build (needs devDependencies for TypeScript)
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./

# Install ALL dependencies (including devDependencies for tsc and @types/*)
RUN npm ci

COPY . .

# Generate Prisma Client and compile TypeScript
RUN npx prisma generate && npm run build

# Stage 2: Production (lean image)
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled output and Prisma artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["npm", "start"]