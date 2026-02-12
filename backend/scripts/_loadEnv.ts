import path from "path";
import dotenv from "dotenv";

// Dev-only scripts executed via ts-node/register do not automatically load backend/.env.
// Load it here so seeds/audits are reproducible without exporting env vars manually.
const envFileOverride = String(process.env.ENV_FILE || "").trim();
const envPath = envFileOverride
  ? path.isAbsolute(envFileOverride)
    ? envFileOverride
    : path.resolve(process.cwd(), envFileOverride)
  : path.resolve(__dirname, "..", ".env");

dotenv.config({ path: envPath });
