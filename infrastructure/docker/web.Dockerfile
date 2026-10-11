# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:24-bookworm-slim
FROM ${NODE_IMAGE} AS base

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

RUN corepack enable \
    && corepack prepare pnpm@10.15.1 --activate

WORKDIR /workspace

FROM base AS dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
COPY . .
RUN test -n "$NEXT_PUBLIC_API_BASE_URL" \
    && pnpm --filter @tradenest/contracts build \
    && pnpm --filter @tradenest/web build

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000

COPY --from=build /workspace /workspace
RUN chown -R node:node /workspace/apps/web/.next

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["pnpm", "--filter", "@tradenest/web", "exec", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
