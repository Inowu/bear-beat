import path from "path";
import dotenv from "dotenv";

// Dev-only scripts executed via ts-node/register do not automatically load backend/.env.
// Load it here so seeds/audits are reproducible without exporting env vars manually.
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

