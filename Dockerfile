FROM node:22-bookworm-slim AS angular-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.html manus-routes.json schema.sql products.js server.js ./
COPY public ./public
COPY --from=angular-build /app/frontend/dist/frontend ./frontend/dist/frontend

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
