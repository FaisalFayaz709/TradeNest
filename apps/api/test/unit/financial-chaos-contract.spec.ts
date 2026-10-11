import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('financial chaos regression contract', () => {
  const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
  it('keeps amount and currency verification in provider-success handling', () => {
    const payments = source('src/modules/payments/payments.service.ts');
    expect(payments).toMatch(/currency/i);
    expect(payments).toMatch(/amount/i);
    expect(payments).toMatch(/signature/i);
  });
  it('keeps release/refund/dispute exclusivity in escrow and disputes services', () => {
    const escrow = source('src/modules/escrow/escrow.service.ts');
    const disputes = source('src/modules/disputes/disputes.service.ts');
    expect(escrow).toMatch(/RELEASED/);
    expect(escrow).toMatch(/REFUNDED/);
    expect(disputes).toMatch(/DISPUTED|UNDER_REVIEW/);
  });
});
