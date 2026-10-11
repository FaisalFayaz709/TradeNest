import { jest } from '@jest/globals';
import { checkoutPaymentDeadline, checkoutPaymentTtlMinutes, checkoutSweepSeconds } from '../../src/modules/orders/checkout-expiration.policy.js';
import { OrderExpirationService } from '../../src/modules/orders/order-expiration.service.js';

describe('Checkout: payment reservation expiry policy', () => {
  it('has a bounded explicit default (30 minutes)', () => {
    expect(checkoutPaymentTtlMinutes(undefined)).toBe(30);
    expect(checkoutPaymentDeadline(new Date('2026-01-01T00:00:00Z'), 30).toISOString()).toBe('2026-01-01T00:30:00.000Z');
    expect(checkoutSweepSeconds(undefined)).toBe(60);
  });
  it.each(['0', '-1', 'NaN', '1.5', '4', '1441', ' 30'])('rejects unsafe TTL %s', (value) => {
    expect(() => checkoutPaymentTtlMinutes(value)).toThrow();
  });
  it.each(['0','9','3601','x',' 60'])('rejects unsafe sweep interval %s', (value) => {
    expect(() => checkoutSweepSeconds(value)).toThrow();
  });
  it('expires an internal pending order and restores stock once', async () => {
    const repository = {
      listExpiredPendingOrderIds: jest.fn().mockResolvedValue(['order-1']),
      lockById: jest.fn().mockResolvedValue(true),
      findOrderDetail: jest.fn().mockResolvedValue({
        status: 'PENDING_PAYMENT', paymentExpiresAt: new Date('2026-01-01T00:00:00Z'),
        items: [{ productId: 'product-1', quantity: 2 }],
      }),
      cancelPendingPaymentOrder: jest.fn().mockResolvedValue(true),
    };
    const tx = { runSerializable: jest.fn(async (fn: (transaction: unknown) => Promise<unknown>) => fn({})) };
    const catalog = { releaseInventoryReservation: jest.fn().mockResolvedValue(undefined) };
    const payments = { orderCancellationContext: jest.fn().mockResolvedValue({ status:'PENDING', externalPending:false }) };
    const service = new OrderExpirationService(repository as never, tx as never, catalog as never, payments as never);
    const result = await service.sweepOnce(new Date('2026-01-01T00:01:00Z'));
    expect(result).toEqual({expired:1,skippedProviderPending:0,examined:1});
    expect(repository.cancelPendingPaymentOrder).toHaveBeenCalledTimes(1);
    expect(catalog.releaseInventoryReservation).toHaveBeenCalledWith('product-1',2,expect.anything());
  });
  it('never releases inventory if a provider attempt is still pending', async () => {
    const repository = {
      listExpiredPendingOrderIds: jest.fn().mockResolvedValue(['order-2']),
      lockById: jest.fn().mockResolvedValue(true),
      findOrderDetail: jest.fn().mockResolvedValue({
        status: 'PENDING_PAYMENT', paymentExpiresAt: new Date('2026-01-01T00:00:00Z'),
        items: [{productId:'product-2',quantity:1}],
      }),
      cancelPendingPaymentOrder: jest.fn(),
    };
    const tx = { runSerializable: jest.fn(async (fn: (transaction: unknown) => Promise<unknown>) => fn({})) };
    const catalog = { releaseInventoryReservation: jest.fn() };
    const payments = { orderCancellationContext: jest.fn().mockResolvedValue({ status:'PENDING', externalPending:true }) };
    const service = new OrderExpirationService(repository as never,tx as never,catalog as never,payments as never);
    expect(await service.sweepOnce(new Date('2026-01-01T00:01:00Z'))).toEqual({expired:0,skippedProviderPending:1,examined:1});
    expect(repository.cancelPendingPaymentOrder).not.toHaveBeenCalled();
    expect(catalog.releaseInventoryReservation).not.toHaveBeenCalled();
  });
  it('never releases inventory if a payment is already succeeded', async () => {
    const repository = {
      listExpiredPendingOrderIds: jest.fn().mockResolvedValue(['order-3']),
      lockById: jest.fn().mockResolvedValue(true),
      findOrderDetail: jest.fn().mockResolvedValue({status:'PENDING_PAYMENT',paymentExpiresAt:new Date('2026-01-01'),items:[{productId:'p',quantity:1}]}),
      cancelPendingPaymentOrder: jest.fn(),
    };
    const tx = { runSerializable: jest.fn(async (fn: (transaction: unknown) => Promise<unknown>) => fn({})) };
    const catalog = { releaseInventoryReservation: jest.fn() };
    const payments = { orderCancellationContext: jest.fn().mockResolvedValue({ status:'SUCCEEDED', externalPending:false }) };
    const service = new OrderExpirationService(repository as never,tx as never,catalog as never,payments as never);
    expect((await service.sweepOnce(new Date('2026-01-02'))).expired).toBe(0);
    expect(catalog.releaseInventoryReservation).not.toHaveBeenCalled();
  });
});
