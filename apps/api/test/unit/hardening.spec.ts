import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RATE_LIMIT_POLICIES } from '../../src/common/rate-limit/rate-limit.policies.js';

describe('the implementation hardening contract', () => {
  const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

  it('keeps every architecture minimum sensitive operation behind an explicit rate-limit policy', () => {
    for (const policy of [
      'AUTH_REGISTER_IP',
      'AUTH_LOGIN_IP',
      'AUTH_CHANGE_PASSWORD_PRINCIPAL',
      'CHECKOUT_PRINCIPAL',
      'PAYMENT_CREATE_PRINCIPAL',
      'BEHAVIOR_EVENT_PRINCIPAL_OR_IP',
      'ADMIN_SENSITIVE_PRINCIPAL',
    ] as const) {
      expect(RATE_LIMIT_POLICIES[policy].limit).toBeGreaterThan(0);
      expect(RATE_LIMIT_POLICIES[policy].windowMs).toBeGreaterThan(0);
    }
  });

  it('covers direct Admin financial and catalog commands with the Admin-sensitive limiter', () => {
    const categories = source('src/modules/catalog/categories.controller.ts');
    const products = source('src/modules/catalog/products.controller.ts');
    const disputes = source('src/modules/disputes/disputes.controller.ts');
    const escrow = source('src/modules/escrow/escrow.controller.ts');
    expect(categories.match(/ADMIN_SENSITIVE_PRINCIPAL/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(products).toContain("@RateLimit('ADMIN_SENSITIVE_PRINCIPAL')");
    expect(disputes).toContain("@RateLimit('ADMIN_SENSITIVE_PRINCIPAL')");
    expect(escrow.match(/ADMIN_SENSITIVE_PRINCIPAL/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('retains audit writes for release, refund, and dispute resolution', () => {
    expect(source('src/modules/escrow/escrow-commands.service.ts')).toMatch(/ESCROW_RELEASE[\s\S]*ESCROW_REFUND/);
    expect(source('src/modules/disputes/disputes.service.ts')).toContain("action: 'DISPUTE_RESOLUTION'");
    const catalog = source('src/modules/catalog/catalog.service.ts');
    expect(catalog).toContain("action: 'CATEGORY_CREATE'");
    expect(catalog).toContain("action: 'CATEGORY_UPDATE'");
    expect(catalog).toContain("action: 'PRODUCT_DELETE'");
  });
});
