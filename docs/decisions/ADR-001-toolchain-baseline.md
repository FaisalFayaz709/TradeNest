# ADR-001 — this decision Toolchain Baseline

- **Status:** Accepted for this decision
- **Classification:** ALLOWED IMPLEMENTATION DECISION
- **Blueprint authority:** The blueprint remains authoritative.

## Context

The blueprint locks Node.js 24 LTS, Next.js 16, React, NestJS, TypeScript, Zod 4, PostgreSQL 18, Prisma ORM 7, pnpm, and a Python/FastAPI AI service. It does not lock every framework minor/patch or the Python minor version.

## Decision

1. Use the Next.js 16 line and React 19.2-compatible line.
2. Use the current NestJS 12 line for this decision shell, with Node.js 24 LTS and an engine floor compatible with its CLI tooling.
3. Keep the API project ESM-oriented from the beginning so later Prisma ORM 7 integration does not require a CommonJS-to-ESM architectural rewrite.
4. Use TypeScript 5.9-compatible configuration.
5. Use Python 3.12–3.13 for the FastAPI/ML environment unless a later dependency requires a narrower compatible choice.
6. Package manifests constrain locked products to their locked major lines. The generated `pnpm-lock.yaml` becomes the exact dependency resolution after installation.

## Consequences

- No locked blueprint decision is changed.
- A future dependency upgrade may move within a locked major line if compatible.
- Moving to a different locked major (for example Next.js 17, Prisma 8, Zod 5, PostgreSQL 19, or Node.js 26) is forbidden without changing the blueprint itself.
