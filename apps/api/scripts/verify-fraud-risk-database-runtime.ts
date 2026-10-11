import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { AnalyticsRepository } from '../src/modules/analytics/analytics.repository.js';
import { PrismaService } from '../src/database/prisma.service.js';

async function main(): Promise<void> {
  const prisma = new PrismaService();
  try {
    const repository = new AnalyticsRepository(prisma);
    const signals = await repository.fraudRiskSignals(randomUUID(), randomUUID(), 'USD');
    if (signals.failedPayments24h !== 0 || signals.paymentAttempts1h !== 0 || signals.paymentAttempts24h !== 0 || signals.priorSucceededPayments !== 0) {
      throw new Error('Unknown-user fraud payment aggregates must be zero.');
    }
    if (signals.distinctIpAddresses24h !== 0 || signals.distinctUserAgents24h !== 0) {
      throw new Error('Unknown-user session churn aggregates must be zero.');
    }
    const alerts = await repository.listFraudAssessments({ limit: 1 });
    if (!Array.isArray(alerts)) throw new Error('Fraud assessment table query did not return an array.');
    console.log('the implementation FRAUD RISK DATABASE VERIFICATION PASSED');
  } finally {
    await prisma.$disconnect();
  }
}

await main();
