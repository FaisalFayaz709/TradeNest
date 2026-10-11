# Locked Technology Stack

**Classification: LOCKED unless explicitly marked otherwise.**

Source: TradeNest Technical Blueprint §2, pp. 2–3.

| Layer | Decision | Classification |
|---|---|---|
| Frontend | Next.js 16 + React + TypeScript | LOCKED |
| Styling/UI | Tailwind CSS + shadcn/ui | LOCKED |
| Core backend | Node.js 24 LTS + NestJS + TypeScript | LOCKED |
| Architecture | Modular monolith | LOCKED |
| API | REST + OpenAPI/Swagger | LOCKED |
| Validation/contracts | Zod 4 | LOCKED |
| Database | PostgreSQL 18 | LOCKED |
| ORM | Prisma ORM 7 | LOCKED |
| Authentication | JWT access tokens + refresh sessions + bcrypt | LOCKED |
| Authorization | RBAC + ownership/policy checks | LOCKED |
| AI service | Python + FastAPI | LOCKED |
| ML/data | scikit-learn + pandas + NumPy | LOCKED |
| Storage | S3-compatible object storage **or** Cloudinary | LOCKED choice set; exact provider is an implementation decision |
| Testing | Jest + Playwright + pytest | LOCKED |
| Development | pnpm + Git/GitHub + Docker Compose | LOCKED |

## Locked responsibility split

The blueprint defines this responsibility model:

```text
Next.js             -> user experience
NestJS              -> business and financial rules
PostgreSQL          -> durable transactional state / final integrity boundary
Python + FastAPI    -> machine-learning workloads
Zod                 -> TypeScript application-boundary validation
```

## Forbidden substitutions

Without a formal blueprint revision, do not substitute examples such as:

- Express/Fastify as the primary backend instead of NestJS;
- MySQL/MongoDB instead of PostgreSQL;
- Drizzle/TypeORM instead of Prisma;
- Joi/class-validator as a replacement for the locked Zod contract role;
- Flask/Django as a replacement for the FastAPI AI service;
- microservices as the core marketplace architecture;
- GraphQL as a replacement for the specified REST API.

The issue is not whether those technologies are capable; they are simply outside the locked blueprint.
