# TradeNest NestJS API source

This directory contains the NestJS application bootstrap, platform infrastructure, and the marketplace business modules under `modules/`.

The API remains one modular-monolith deployable backed by PostgreSQL. Controllers must never call Prisma directly; persistence belongs to module-owned repositories/infrastructure and cross-module calls use explicit `public/` seams.
