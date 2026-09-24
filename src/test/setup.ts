// Database integration tests (*.int.test.ts) run against TEST_DATABASE_URL,
// never against the development database. Without it they are skipped.
// Set before any test file imports src/lib/prisma.ts.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

export const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
