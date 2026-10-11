import { jest } from '@jest/globals';
import { normalizeRequestId, requestIdMiddleware } from '../../src/common/http/request-id.js';

describe('request correlation hardening', () => {
  it('preserves a safe client request id', () => {
    expect(normalizeRequestId('trace-1234:checkout')).toBe('trace-1234:checkout');
  });

  it('replaces oversized or unsafe request ids with server UUIDs', () => {
    expect(normalizeRequestId('x'.repeat(129))).toMatch(/^[0-9a-f-]{36}$/);
    expect(normalizeRequestId('unsafe request id')).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('writes one canonical request id to both request and response', () => {
    const request = { headers: { 'x-request-id': 'trace-5678' } } as never;
    const setHeader = jest.fn();
    const response = { setHeader } as never;
    const next = jest.fn();

    requestIdMiddleware(request, response, next);

    expect((request as any).headers['x-request-id']).toBe('trace-5678');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'trace-5678');
    expect(next).toHaveBeenCalledTimes(1);
  });
});
