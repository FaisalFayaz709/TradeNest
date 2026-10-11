import {assertLocalTestDatabaseUrl} from '../apps/api/scripts/fulfillment-test-database-guard.ts';
assertLocalTestDatabaseUrl(process.env.DATABASE_URL);
console.log('FULFILLMENT DATABASE GUARD PASSED: isolated localhost test database.');
