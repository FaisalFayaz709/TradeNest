/** Guard all Database writes to a dedicated, loopback-only *_test database. */
const raw = process.env.TEST_DATABASE_URL;
let databaseName;
try {
  if (!raw) throw Error('TEST_DATABASE_URL is required');
  const url = new URL(raw);
  databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw Error('Only PostgreSQL URLs are allowed');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw Error('Only localhost targets are allowed');
  if (!/^tradenest(?:_[a-z0-9]+)*_test$/.test(databaseName)) throw Error('Database name must match tradenest_*_test (e.g., tradenest_test)');
  if (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public') throw Error('Database requires the public schema');
  if (!url.username || !url.password) throw Error('Dedicated database URL requires username and password');
} catch (error) {
  console.error(`DATABASE TEST TARGET REFUSED: ${error.message}`);
  process.exit(1);
}
console.log(`DATABASE TEST TARGET VERIFIED: localhost database ${databaseName} (no destructive reset).`);
