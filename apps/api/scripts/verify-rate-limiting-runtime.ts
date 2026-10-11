import { RateLimitService } from '../src/common/rate-limit/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const service = new RateLimitService();
const now = 10_000;
for (let index = 0; index < 5; index += 1) {
  assert(service.consume('AUTH_REGISTER_IP', 'ip:198.51.100.10', now).allowed, 'registration bucket denied too early');
}
const registrationDenied = service.consume('AUTH_REGISTER_IP', 'ip:198.51.100.10', now);
assert(!registrationDenied.allowed, 'registration bucket did not deny at configured threshold');
assert(registrationDenied.retryAfterSeconds === 900, 'registration retry window mismatch');

const authenticatedRequest = {
  ip: '198.51.100.11',
  socket: { remoteAddress: '198.51.100.11' },
  auth: { userId: 'buyer-1' },
};
assert(
  service.keyFor('BEHAVIOR_EVENT_PRINCIPAL_OR_IP', authenticatedRequest as never) === 'user:buyer-1',
  'authenticated event rate limit must key on the server-authenticated user',
);

const loginRequest = {
  ip: '198.51.100.12',
  socket: { remoteAddress: '198.51.100.12' },
  body: { email: 'buyer@example.com' },
};
const identityKey = service.keyFor('AUTH_LOGIN_IDENTITY', loginRequest as never);
assert(/^identity:[0-9a-f]{64}$/.test(identityKey), 'login identity bucket must use a SHA-256 digest');
assert(!identityKey.includes('buyer@example.com'), 'login identity bucket must not retain plaintext email');

for (let index = 0; index < 30; index += 1) {
  assert(
    service.consume('PAYMENT_WEBHOOK_INVALID_SIGNATURE_IP', 'provider:sandbox:ip:198.51.100.13', now).allowed,
    'invalid webhook bucket denied too early',
  );
}
assert(
  !service.consume('PAYMENT_WEBHOOK_INVALID_SIGNATURE_IP', 'provider:sandbox:ip:198.51.100.13', now).allowed,
  'invalid webhook bucket did not deny after threshold',
);

console.log('the implementation rate limiting runtime verification passed.');
