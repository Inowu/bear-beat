import { loadEnvOnce } from "../src/utils/loadEnv";

// Ensure unit/integration tests do not accidentally load backend/.env (may contain real secrets).
// loadEnvOnce() defaults to backend/.env.example when NODE_ENV === "test", unless ENV_FILE overrides.
loadEnvOnce();

// Keep this file strictly ASCII (GitHub warns on hidden/bidi Unicode in diffs).
// Safety: never allow tests to run against staging/prod databases.
// Use `npm run test:local` (repo root) to run CI-parity tests against a disposable local DB.
const dbUrl = String(process.env.DATABASE_URL || "").trim();
if (!dbUrl) {
  throw new Error(
    "[TEST] DATABASE_URL is required. Use `npm run test:local` from repo root.",
  );
}

try {
  const parsed = new URL(dbUrl);
  const host = parsed.hostname;
  const dbName = parsed.pathname.replace(/^\//, "");

  const isLocalHost = host === "127.0.0.1" || host === "localhost";
  if (!isLocalHost || dbName !== "bearbeat_test") {
    throw new Error(
      `[TEST] Refusing to run tests against non-local or non-test DB (host=${host} db=${dbName}). ` +
        "Use `npm run test:local` from repo root.",
    );
  }
} catch (e) {
  // If URL parsing fails, fail closed.
  throw new Error(
    `[TEST] Invalid DATABASE_URL for tests. Use \`npm run test:local\`. (${e instanceof Error ? e.message : String(e)})`,
  );
}
