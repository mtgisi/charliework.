FROM node:20-alpine AS client-builder
WORKDIR /build
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./
COPY --from=client-builder /build/dist ./public
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "server.js"]
