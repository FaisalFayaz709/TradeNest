## TradeNest Pull Request

### Scope

Describe the change.

### Blueprint classification

- [ ] LOCKED requirement implementation
- [ ] ALLOWED IMPLEMENTATION DECISION
- [ ] No architecture-sensitive decision

If this includes an implementation decision, link the ADR:

`docs/decisions/ADR-___-____.md`

### Architecture guardrails

- [ ] Locked stack unchanged
- [ ] Modular monolith preserved
- [ ] No Controller → Prisma direct access
- [ ] No arbitrary cross-module writes
- [ ] Frontend does not declare authoritative financial/order state
- [ ] FastAPI is not browser-facing
- [ ] RBAC + ownership/policy checks preserved where applicable
- [ ] Financial changes are transactional/idempotent/audited where applicable
- [ ] State changes use domain commands, not arbitrary status patching
- [ ] PostgreSQL constraints remain final integrity guardrails
- [ ] AI does not silently mutate critical business data

### Tests

Describe tests added/updated.

### Architecture review result

- [ ] PASS
- [ ] Not architecture-sensitive
