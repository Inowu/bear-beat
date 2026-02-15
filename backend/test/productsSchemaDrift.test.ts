import { prisma } from "../src/db";

jest.setTimeout(60_000);

describe("DB schema drift guardrails", () => {
  it("products tables exist after migrations", async () => {
    // If a migration is missing, Prisma throws (ex. P2021: table does not exist).
    await expect(prisma.products.findMany({ take: 1 })).resolves.toBeDefined();
    await expect(prisma.product_orders.findMany({ take: 1 })).resolves.toBeDefined();
  });
});
