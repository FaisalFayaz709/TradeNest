# ADR-000 — <Decision Title>

- **Status:** Proposed | Accepted | Superseded | Rejected
- **Date:** YYYY-MM-DD
- **Classification:** ALLOWED IMPLEMENTATION DECISION
- **Blueprint compatibility:** <sections/pages checked>

## Context

What problem must be decided? What does the blueprint say, and what does it leave unspecified?

## Constraints

List every locked TradeNest requirement that constrains this choice.

## Decision

State the chosen implementation.

## Alternatives considered

1. Alternative A
2. Alternative B

## Consequences

### Positive

- ...

### Negative / tradeoffs

- ...

## Compliance check

- [ ] Does not change the locked technology stack.
- [ ] Does not split the core marketplace into microservices.
- [ ] Preserves NestJS business/financial authority.
- [ ] Preserves PostgreSQL integrity responsibilities.
- [ ] Preserves domain state-machine rules.
- [ ] Preserves security/financial-integrity rules.
- [ ] Does not expose FastAPI directly to the browser.
- [ ] Does not let AI silently mutate critical business data.

## Rollback / supersession

How can this implementation decision be changed later without violating the blueprint?
