import { prisma } from "../src/db";
import { router } from "../src/trpc";
import { plansRouter } from "../src/routers/Plans.router";

jest.setTimeout(60_000);

describe("plans.getPublicBestPlans", () => {
  const testRouter = router({
    plans: plansRouter,
  });

  const caller = testRouter.createCaller({
    req: { headers: { "x-bb-audit-readonly": "1" } } as any,
    res: {} as any,
    prisma,
    session: null,
  });

  const baseName = `jest-public-best-plans-${Date.now()}`;

  afterAll(async () => {
    await prisma.plans
      .deleteMany({
        where: { name: { startsWith: baseName } },
      })
      .catch(() => null);
  });

  it("returns best MXN/USD plans (prefers Stripe price, then PayPal) and excludes plan 41", async () => {
    // Excluded migration plan id (should never be the public "best plan").
    await prisma.plans.create({
      data: {
        id: 41,
        name: `${baseName}-excluded`,
        description: "excluded",
        moneda: "mxn",
        homedir: "/",
        gigas: BigInt(500),
        price: "1.00",
        duration: "30 dias",
        activated: 1,
        stripe_prod_id: null,
        stripe_prod_id_test: "price_excluded",
        paypal_plan_id: null,
        paypal_plan_id_test: "P-EXCLUDED",
      },
    });

    const mxnStripeOnly = await prisma.plans.create({
      data: {
        name: `${baseName}-mxn-stripe-only`,
        description: "mxn stripe only",
        moneda: "mxn",
        homedir: "/",
        gigas: BigInt(500),
        price: "350.00",
        duration: "30 dias",
        activated: 1,
        stripe_prod_id: null,
        stripe_prod_id_test: "price_mxn_stripe_only",
        paypal_plan_id: null,
        paypal_plan_id_test: null,
      },
    });

    const mxnStripePaypal = await prisma.plans.create({
      data: {
        name: `${baseName}-mxn-stripe-paypal`,
        description: "mxn stripe + paypal",
        moneda: "mxn",
        homedir: "/",
        gigas: BigInt(500),
        price: "350.00",
        duration: "30 dias",
        activated: 1,
        stripe_prod_id: null,
        stripe_prod_id_test: "price_mxn_stripe_paypal",
        paypal_plan_id: null,
        paypal_plan_id_test: "P-MXN-TEST",
      },
    });

    const usdStripe = await prisma.plans.create({
      data: {
        name: `${baseName}-usd-stripe`,
        description: "usd stripe",
        moneda: "usd",
        homedir: "/",
        gigas: BigInt(500),
        price: "19.99",
        duration: "30 dias",
        activated: 1,
        stripe_prod_id: null,
        stripe_prod_id_test: "price_usd_stripe",
        paypal_plan_id: null,
        paypal_plan_id_test: null,
      },
    });

    const res = await caller.plans.getPublicBestPlans();

    expect(res.mxn?.planId).toBe(mxnStripePaypal.id);
    expect(res.mxn?.currency).toBe("mxn");
    expect(res.mxn?.price).toBeGreaterThan(0);
    expect(res.mxn?.gigas).toBeGreaterThan(0);
    expect(res.mxn?.hasPaypal).toBe(true);

    expect(res.usd?.planId).toBe(usdStripe.id);
    expect(res.usd?.currency).toBe("usd");
    expect(res.usd?.hasPaypal).toBe(false);

    // Ensure the excluded plan didn't "win" despite being cheaper.
    expect(res.mxn?.planId).not.toBe(41);
    expect(res.usd?.planId).not.toBe(41);

    // Sanity: stripe-only plan should lose to stripe+paypal on tie.
    expect(mxnStripeOnly.id).not.toBe(mxnStripePaypal.id);
  });
});

