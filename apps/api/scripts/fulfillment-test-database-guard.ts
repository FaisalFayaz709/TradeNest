/** No destructive integration fixtures on remote or production databases. */
export function assertLocalTestDatabaseUrl(raw: string | undefined): asserts raw is string {
  if (!raw) throw new Error('DATABASE_URL must point to an isolated local test database.');
  const url = new URL(raw);
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const testDb = /(^|[_-])(test|testing)([_-]|$)/i.test(url.pathname.slice(1));
  if (!local || !testDb) throw new Error('TEST_DATABASE_GUARD: localhost-only database with test in its name required.');
}
