FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.html manus-routes.json schema.sql products.js server.js ./
COPY public ./public

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.js"]
