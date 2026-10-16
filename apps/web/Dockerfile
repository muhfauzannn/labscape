FROM node:24-bookworm-slim

WORKDIR /app
RUN npm install --global pnpm@12.11.2

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
RUN pnpm build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "apps/web/scripts/docker-start.sh"]
