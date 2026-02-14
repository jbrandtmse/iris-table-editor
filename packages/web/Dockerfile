# Multi-stage Dockerfile for IRIS Table Editor web application
# Build from repo root: docker build -f packages/web/Dockerfile .

# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Copy workspace root files for npm ci
COPY package.json package-lock.json ./

# Copy workspace package.json files (for npm workspace resolution)
COPY packages/core/package.json packages/core/
COPY packages/webview/package.json packages/webview/
COPY packages/web/package.json packages/web/

# Install all dependencies (including devDependencies for compilation)
RUN npm ci --workspace=packages/web --workspace=packages/core --workspace=packages/webview

# Copy source code for all required workspace packages
COPY packages/core/ packages/core/
COPY packages/webview/ packages/webview/
COPY packages/web/ packages/web/

# Compile TypeScript
RUN npm run compile --workspace=packages/core --workspace=packages/web

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production

# Copy workspace root files for npm ci
COPY --from=build /app/package.json /app/package-lock.json ./

# Copy workspace package.json files
COPY --from=build /app/packages/core/package.json packages/core/
COPY --from=build /app/packages/webview/package.json packages/webview/
COPY --from=build /app/packages/web/package.json packages/web/

# Install production dependencies only
RUN npm ci --workspace=packages/web --workspace=packages/core --workspace=packages/webview --omit=dev

# Copy compiled output and static assets
COPY --from=build /app/packages/core/dist/ packages/core/dist/
COPY --from=build /app/packages/webview/src/ packages/webview/src/
COPY --from=build /app/packages/web/dist/ packages/web/dist/
COPY --from=build /app/packages/web/public/ packages/web/public/

# Run as non-root user for security
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000)+'/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "packages/web/dist/server/server.js"]
