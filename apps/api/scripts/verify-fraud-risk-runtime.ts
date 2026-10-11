import 'dotenv/config';
import { AuthorizationService } from '../src/common/authorization/authorization.service.js';
import { RateLimitService } from '../src/common/rate-limit/index.js';
import { AdminService } from '../src/modules/admin/admin.service.js';
import { AIBridgeService } from '../src/modules/ai-bridge/ai-bridge.service.js';
import { PaymentsService } from '../src/modules/payments/payments.service.js';

const USER_ID = '10000000-0000-4000-8000-000000000020';
const ORDER_ID = '30000000-0000-4000-8000-000000000020';
const PAYMENT_ID = '60000000-0000-4000-8000-000000000020';

async function main(): Promise<void> {
  const calls: string[] = [];
  const expectedAlert = {
    id: '70000000-0000-4000-8000-000000000020',
    userId: USER_ID,
    orderId: ORDER_ID,
    paymentId: PAYMENT_ID,
    riskScore: 0.82,
    riskLevel: 'HIGH' as const,
    reasons: [{ code: 'REPEATED_PAYMENT_FAILURES' as const, message: 'Repeated failures.', contribution: 0.36 }],
    reviewRecommended: true,
    modelVersion: 'fraud-rules-v1',
    createdAt: '2026-10-06T00:00:00.000Z',
  };
  const analytics = {
    async fraudRiskSignals(userId: string, paymentId: string, currency: string) {
      if (userId !== USER_ID || paymentId !== PAYMENT_ID || currency !== 'USD') throw new Error('Fraud signal subject mismatch.');
      calls.push('signals');
      return {
        failedPayments24h: 3,
        paymentAttempts1h: 6,
        paymentAttempts24h: 8,
        priorSucceededPayments: 0,
        distinctIpAddresses24h: 4,
        distinctUserAgents24h: 4,
        marketP95Amount: '90.00',
      };
    },
    async recordFraudAssessment(subject: any, score: any) {
      if (subject.paymentId !== PAYMENT_ID || score.riskLevel !== 'HIGH' || score.reviewRecommended !== true) throw new Error('Fraud persistence payload mismatch.');
      calls.push('persist');
      return expectedAlert;
    },
    async listFraudAlerts(query: any) {
      if (query.limit !== 20 || query.riskLevel !== 'HIGH') throw new Error('Admin fraud query mismatch.');
      calls.push('admin-list');
      return [expectedAlert];
    },
  };
  const ai = {
    async fraudRisk(input: any) {
      if (input.payment.amount !== '100.00' || input.payment.outcome !== 'FAILED' || input.signals.failedPayments24h !== 3) throw new Error('Fraud AI payload mismatch.');
      calls.push('fraud-ai');
      return {
        riskScore: 0.82,
        riskLevel: 'HIGH',
        reasons: expectedAlert.reasons,
        reviewRecommended: true,
        modelVersion: 'fraud-rules-v1',
        generatedAt: '2026-10-06T00:00:00.000Z',
      };
    },
  };

  const bridge = new AIBridgeService(new AuthorizationService(), analytics as never, {} as never, ai as never);
  const alert = await bridge.assessPaymentRisk({
    userId: USER_ID,
    orderId: ORDER_ID,
    paymentId: PAYMENT_ID,
    amount: '100.00',
    currency: 'USD',
    outcome: 'FAILED',
    occurredAt: '2026-10-06T00:00:00.000Z',
  });
  if (!alert.reviewRecommended || alert.riskLevel !== 'HIGH') throw new Error('High-risk assessment must recommend review.');

  const admin = new AdminService(new AuthorizationService(), analytics as never);
  const principal = { userId: '90000000-0000-4000-8000-000000000020', sessionId: '91000000-0000-4000-8000-000000000020', email: 'admin@example.invalid', name: 'Admin', role: 'ADMIN' as const };
  const list = await admin.fraudAlerts(principal, { limit: 20, riskLevel: 'HIGH' });
  if (list.length !== 1 || list[0]?.paymentId !== PAYMENT_ID) throw new Error('Admin alert list mismatch.');

  let forbidden = false;
  try { await admin.fraudAlerts({ ...principal, role: 'SELLER' }, { limit: 20, riskLevel: 'HIGH' }); } catch { forbidden = true; }
  if (!forbidden) throw new Error('Fraud alerts must remain Admin-only.');
  if (calls.join('|') !== 'signals|fraud-ai|persist|admin-list') throw new Error(`Unexpected fraud call sequence: ${calls.join('|')}`);

  const paymentCalls: string[] = [];
  const paymentRecord = {
    id: PAYMENT_ID,
    orderId: ORDER_ID,
    buyerId: USER_ID,
    provider: 'sandbox',
    providerPaymentId: 'provider-payment-29',
    status: 'PENDING' as const,
    amount: { toString: () => '100.00' },
    currency: 'USD',
    failureCode: null,
    failureMessage: null,
    paidAt: null,
    createdAt: new Date('2026-10-06T00:00:00.000Z'),
    updatedAt: new Date('2026-10-06T00:00:00.000Z'),
  };
  const paymentRepository = {
    async findByProviderPaymentId() { return paymentRecord; },
    async findById() { return paymentRecord; },
    async markSucceeded() { paymentCalls.push('payment-commit'); },
  };
  const transactions = { async runSerializable(fn: any) { return fn({ client: {} }); } };
  const providers = {
    byId() {
      return {
        id: 'sandbox',
        verifyWebhook() {
          return {
            eventId: '92000000-0000-4000-8000-000000000020',
            provider: 'sandbox',
            type: 'PAYMENT_SUCCEEDED' as const,
            providerPaymentId: 'provider-payment-29',
            amount: '100.00',
            currency: 'USD',
            occurredAt: new Date('2026-10-06T00:00:00.000Z'),
          };
        },
      };
    },
  };
  const orders = {
    async paymentContext() { return { id: 'order', status: 'PENDING_PAYMENT' as const, paymentExpiresAt: null }; },
    async markPaidFromVerifiedPayment() { paymentCalls.push('order-paid'); },
    async paymentInventoryCommitments() { return [{ productId: '40000000-0000-4000-8000-000000000020', quantity: 1 }]; },
  };
  const catalog = { async consumeInventoryReservation() { paymentCalls.push('inventory-consumed'); } };
  const escrow = { async holdVerifiedPayment() { paymentCalls.push('escrow-held'); } };
  const failingAi = { async assessPaymentRisk() { paymentCalls.push('fraud-attempt'); throw new Error('AI unavailable'); } };
  const payments = new PaymentsService(
    paymentRepository as never,
    new AuthorizationService(),
    transactions as never,
    {} as never,
    new RateLimitService(),
    providers as never,
    orders as never,
    catalog as never,
    escrow as never,
    { record: async () => {} } as never,
    failingAi as never,
  );
  const acknowledgement = await payments.handleWebhook('sandbox', Buffer.from('{}'), {});
  if (acknowledgement.status !== 'SUCCEEDED' || acknowledgement.duplicate) throw new Error('Fraud outage changed authoritative payment acknowledgement.');
  if (paymentCalls.join('|') !== 'payment-commit|order-paid|inventory-consumed|escrow-held|fraud-attempt') {
    throw new Error(`Fraud scoring must run after financial commit operations: ${paymentCalls.join('|')}`);
  }

  console.log('the implementation FRAUD RISK RUNTIME VERIFICATION PASSED');
}

await main();
