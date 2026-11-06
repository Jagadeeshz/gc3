# syntax=docker/dockerfile:1
#
# One image, three hosts. Built from the repository root because the API consumes
# the workspace packages as source:
#   docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.34.9 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/types/package.json packages/types/
COPY packages/validation/package.json packages/validation/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --filter @gc3/api... --prod=false

FROM deps AS build
COPY tsconfig.json ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @gc3/api exec prisma generate  && pnpm --filter @gc3/api build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/scripts ./apps/api/scripts
COPY --from=build /repo/apps/api/src/generated ./apps/api/src/generated
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/pnpm-workspace.yaml /repo/pnpm-lock.yaml /repo/package.json ./
WORKDIR /repo/apps/api
EXPOSE 3001
# Migrations and catalogue seeds run before the server accepts traffic, so a
# deploy can never serve against a schema it does not match.
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm exec tsx scripts/seed-pods.ts && pnpm exec tsx scripts/seed-tiers.ts && node dist/index.js"]
