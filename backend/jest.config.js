/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  // Run only the intended test folder (avoid picking up scratch/dev scripts).
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.ts"],
  // Match backend runtime behavior (SlowBuffer polyfill + dotenv).
  setupFiles: ["dotenv/config", "<rootDir>/src/polyfills.ts"],
  // Workspaces: @prisma/client is installed at repo root, but Jest resolves modules
  // relative to `rootDir` and may not walk up like Node's default resolver.
  moduleNameMapper: {
    "^@prisma/client$": "<rootDir>/../node_modules/@prisma/client",
    "^@prisma/client/(.*)$": "<rootDir>/../node_modules/@prisma/client/$1",
    "^bullmq$": "<rootDir>/test/mocks/bullmq.ts",
  },
};
