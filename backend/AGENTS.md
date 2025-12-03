# Repository Guidelines

## Project Structure & Module Organization
- Runtime entry uses `src/index.ts` (nodemon launches via ts-node). HTTP and tRPC logic live under `src/endpoints`, `src/routers`, and `src/procedures`, with shared context/middleware in `src/context`, `src/middleware`, and `src/trpc`. Payments and messaging domains are isolated in `src/stripe`, `src/paypal`, `src/conekta`, `src/twilio`, `src/facebook`, and `src/many-chat`. File processing and notifications flow through `src/queue`, `src/sse`, `src/ftp`, and `src/utils`. Database schema and migrations are in `prisma/`; scripts for maintenance live in `scripts/`; email templates in `emails/`; SSE worker sources in `sse_server/`; disk-usage helper in `storage_server/`. Tests sit under `test/` alongside the occasional root-level `test.ts` scratchpad.

## Build, Test, and Development Commands
- `npm run dev` — start the API in watch mode (nodemon + ts-node).
- `npm test` — run Jest with `ts-jest` and `.env` loaded via `dotenv/config`.
- `npm run compile` — type-check without emitting JS.
- `npm run build` — clean and compile TypeScript to `build/`.
- `npm run build:sse` — compile SSE worker per `tsconfig.sse.json` and copy JS into `build_sse/`.
- `npm run format:check|format:fix` — verify or apply Prettier formatting on `src/**/*.ts`.
- For local deps, `docker-compose up redis db` matches the MySQL/Redis defaults in `docker-compose.yaml`.

## Coding Style & Naming Conventions
- TypeScript-first codebase with ESLint (Airbnb TypeScript base) and project tsconfig. Several formatting rules are relaxed; rely on Prettier for consistency (2-space indent, semicolons, single quotes, trailing commas). Prefer descriptive camelCase for values/functions, PascalCase for classes/types, and kebab-case for filenames/folders.
- Keep domain boundaries intact: route definitions in routers/procedures, business logic in services/utilities, and side-effectful work (queues, SSE) in their dedicated modules.

## Testing Guidelines
- Jest + ts-jest run in Node environment. Place specs under `test/` using `*.test.ts`; co-locate new integration suites there (`npm test -- api.test.ts` to target a single file).
- Tests load environment variables automatically; stub external calls (Stripe, PayPal, Twilio, Facebook) to avoid hitting real services. Include assertions around queue effects, permissions, and DB writes when touching those areas.

## Commit & Pull Request Guidelines
- Follow the existing history’s concise, sentence-case style (e.g., “Handle verification failures so frontend registers them”). Keep scope small and messages focused on the behavioral change.
- PRs should summarize intent, link issues/tasks, list commands run (tests/build), and call out env, migration, or API contract changes. Attach logs or screenshots for API responses when relevant, and note impacts on SSE workers or background scripts.

## Security & Configuration Tips
- Store secrets in a local `.env` (DB, Redis, Stripe, PayPal, Twilio, Brevo, etc.); never commit them. After editing `prisma/schema.prisma`, run `npx prisma generate` and, if schema changes, `npx prisma migrate dev --name <change>`. Keep `redis.conf` and `docker-compose.yaml` in sync with expected ports/credentials before running workers or queue-driven jobs.
