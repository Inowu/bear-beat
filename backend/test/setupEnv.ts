import { loadEnvOnce } from "../src/utils/loadEnv";

// Ensure unit/integration tests do not accidentally load backend/.env (may contain real secrets).
// loadEnvOnce() defaults to backend/.env.example when NODE_ENV === "test", unless ENV_FILE overrides.
loadEnvOnce();

