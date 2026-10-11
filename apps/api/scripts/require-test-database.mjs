const raw = process.env.TEST_DATABASE_URL;
if (!raw) {
  console.error('TEST_DATABASE_URL is required for database integration tests.');
  process.exit(1);
}
let name;
try {
  name = new URL(raw).pathname.replace(/^\//, '').toLowerCase();
} catch {
  console.error('TEST_DATABASE_URL must be a valid PostgreSQL URL.');
  process.exit(1);
}
if (!name.includes('e2e') && !name.includes('test')) {
  console.error(`Refusing database integration tests against non-test database: ${name}`);
  process.exit(1);
}
console.log(`Database integration target accepted: ${name}`);
