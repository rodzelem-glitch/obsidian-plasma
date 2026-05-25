FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
# Service Account Key is mounted/copied during deploy/dev
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
