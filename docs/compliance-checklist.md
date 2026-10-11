# Architecture Compliance Checklist

Use this checklist during design review and before merging architecture-sensitive pull requests.

## Stack

- [ ] Next.js 16 + React + TypeScript remains the frontend.
- [ ] Tailwind CSS + shadcn/ui remains the UI stack.
- [ ] NestJS on Node.js 24 LTS + TypeScript remains the core backend.
- [ ] PostgreSQL 18 remains the database.
- [ ] Prisma ORM 7 remains the ORM.
- [ ] Zod 4 remains the TypeScript contract/boundary validation mechanism.
- [ ] FastAPI + Python remains the AI/ML service.
- [x] Jest / Playwright / pytest remain the required test tools and are wired in this capability.
- [ ] pnpm + Docker Compose remain part of development setup.

## Architecture

- [ ] Core marketplace is still a modular monolith.
- [ ] There is one NestJS marketplace deployable.
- [ ] There is one PostgreSQL marketplace database.
- [ ] Controllers do not call Prisma directly.
- [ ] Modules interact through explicit services/interfaces.
- [ ] Modules do not use arbitrary cross-module table mutation.
- [ ] FastAPI is internal and is not called directly by the browser.

## Authority and validation

- [ ] Next.js does not declare authoritative financial/order truth.
- [ ] Backend reloads authoritative prices and stock at checkout.
- [ ] Zod validates untrusted application-boundary inputs.
- [ ] Services enforce ownership/business/state-transition rules.
- [ ] PostgreSQL has hard integrity constraints for durable guarantees.

## Authentication / authorization

- [ ] bcrypt hashes passwords.
- [ ] Access tokens are JWTs.
- [ ] Refresh tokens/sessions are hashed, rotatable and revocable.
- [ ] `ADMIN` cannot be publicly registered.
- [ ] RBAC is supplemented by ownership/policy checks.

## Financial integrity

- [ ] Client cannot declare payment success.
- [ ] Webhook/provider state is verified.
- [ ] Expected payment amount/currency are checked.
- [ ] Checkout and financial transitions use transactions where specified.
- [ ] Idempotency is applied to financial write operations.
- [ ] Escrow has a ledger (`HOLD` / `RELEASE` / `REFUND`, etc.).
- [x] Sensitive financial/admin actions are audited through the transaction-bound AuditService boundary (this capability hardening).
- [ ] Authoritative money math does not use ordinary JS floating-point arithmetic.

## State machines

- [ ] Order, payment and escrow are separate state machines.
- [ ] Clients cannot arbitrarily PATCH authoritative statuses.
- [ ] Command-style operations perform transitions.
- [ ] Illegal transitions return a conflict (`409 INVALID_STATE_TRANSITION` or equivalent blueprint-defined pattern).
- [ ] Active disputes block automatic escrow release.

## MVP scope

- [ ] Initial checkout permits only one seller per order.
- [ ] Parent/sub-order multi-seller design has not been prematurely introduced into the MVP.
- [ ] Advanced AI is not being built before the reliable commerce/escrow path.

## AI

- [x] Browser sends behavior events to NestJS, not FastAPI.
- [x] AI pricing does not silently change prices.
- [x] Fraud scoring is treated as risk/review logic, not automatic accusation.

## Review result

- [ ] PASS — no locked requirement violated.
- [ ] FAIL — stop merge/build progression and resolve violation.

- [x] Rate limiting hardening (this capability): abuse-sensitive NestJS routes use named bounded policies; payment webhooks throttle invalid signatures only after verification fails.
