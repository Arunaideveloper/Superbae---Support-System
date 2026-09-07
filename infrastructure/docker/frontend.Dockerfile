# Superbae web frontend image (Next.js + React + Tailwind + shadcn/ui, ../frontend)
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3000
# Dev server; the /api proxy target comes from API_PROXY (see docker-compose).
CMD ["npm", "run", "dev"]
