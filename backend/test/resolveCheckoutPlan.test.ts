import { prisma } from "../src/db";
import { router } from "../src/trpc";
import { plansRouter } from "../src/routers/Plans.router";

jest.setTimeout(60_000);

describe("plans.resolveCheckoutPlan", () => {
  const testRouter = router({
    plans: plansRouter,
  });

  const caller = testRouter.createCaller({
    req: { headers: { "x-bb-audit-readonly": "1" } } as any,
    res: {} as any,
    prisma,
    session: null,
  });

  const baseName = `jest-resolve-checkout-${Date.now()}`;

  afterAll(async () => {
    await prisma.plans
      .deleteMany({
        where: { name: { startsWith: baseName } },
      })
      .catch(() => null);
  });

  it("switches legacy plan id to the best Stripe-price sibling (and returns PayPal sibling when available)", async () => {
    const legacy = await prisma.plans.create({
      data: {
        name: `${baseName}-legacy`,
        description: "legacy plan",
        moneda: "mxn",
        homedir: "/",
        gigas: BigInt(500),
        price: "350.00",
        duration: "30 dias",
        activated: 1,
        stripe_prod_id: null,
        stripe_prod_id_test: "",
        paypal_plan_id: null,
        paypal_plan_id_test: null,
      },
    });

    await prisma.plans.create({
      data: {
        name: legacy.name,
        description: "stripe only",
        moneda: legacy.moneda,
        homedir: "/",
        gigas: BigInt(500),
        price: legacy.price,
        duration: legacy.duration,
        activated: 1,
        stripe_prod_id: "price_stripe_only_live",
        stripe_prod_id_test: "price_stripe_only_test",
        paypal_plan_id: null,
        paypal_plan_id_test: null,
      },
    });

    const stripePaypal = await prisma.plans.create({
      data: {
        name: legacy.name,
        description: "stripe + paypal",
        moneda: legacy.moneda,
        homedir: "/",
        gigas: BigInt(500),
        price: legacy.price,
        duration: legacy.duration,
        activated: 1,
        stripe_prod_id: "price_stripe_paypal_live",
        stripe_prod_id_test: "price_stripe_paypal_test",
        paypal_plan_id: "P-PAYPAL-LIVE",
        paypal_plan_id_test: "P-PAYPAL-TEST",
      },
    });

    const res = await caller.plans.resolveCheckoutPlan({ planId: legacy.id });
    expect(res.requestedPlanId).toBe(legacy.id);
    expect(res.resolvedPlanId).toBe(stripePaypal.id);
    expect(res.plan?.id).toBe(stripePaypal.id);
    expect(res.paypalPlan?.id).toBe(stripePaypal.id);
    expect(res.checkout?.currency).toBe("MXN");
    expect(res.checkout?.price).toBe(350);
    expect(res.checkout?.availableMethods.slice(0, 3)).toEqual(["card", "paypal", "spei"]);
    expect(res.checkout?.planDisplayName).toBe(stripePaypal.name);
    expect(res.checkout?.quotaGb).toBe(500);
    expect(res.checkout?.requiresRecurringConsentMethods).toEqual(["card", "paypal"]);
    expect(res.checkout?.trialAllowedMethods).toEqual(["card"]);
  });

  it("keeps requested plan when Stripe price is valid, but can return a PayPal-capable sibling", async () => {
    const requested = await prisma.plans.create({
      data: {
        name: `${baseName}-requested`,
        description: "requested plan",
        moneda: "usd",
        homedir: "/",
        gigas: BigInt(500),
        price: "19.99",
        duration: "30 dias",
        activated: 1,
        stripe_prod_id: "price_requested_live",
        stripe_prod_id_test: "price_requested_test",
        paypal_plan_id: null,
        paypal_plan_id_test: null,
      },
    });

    const paypalSibling = await prisma.plans.create({
      data: {
        name: requested.name,
        description: "paypal sibling",
        moneda: requested.moneda,
        homedir: "/",
        gigas: BigInt(500),
        price: requested.price,
        duration: requested.duration,
        activated: 1,
        stripe_prod_id: "price_paypal_sibling_live",
        stripe_prod_id_test: "price_paypal_sibling_test",
        paypal_plan_id: "P-PAYPAL-SIB-LIVE",
        paypal_plan_id_test: "P-PAYPAL-SIB-TEST",
      },
    });

    const res = await caller.plans.resolveCheckoutPlan({ planId: requested.id });
    expect(res.resolvedPlanId).toBe(requested.id);
    expect(res.plan?.id).toBe(requested.id);
    expect(res.paypalPlan?.id).toBe(paypalSibling.id);
    expect(res.checkout?.currency).toBe("USD");
    expect(res.checkout?.availableMethods).toEqual(["card", "paypal"]);
    expect(res.checkout?.planDisplayName).toBe(requested.name);
    expect(res.checkout?.quotaGb).toBe(500);
    expect(res.checkout?.requiresRecurringConsentMethods).toEqual(["card", "paypal"]);
    expect(res.checkout?.trialAllowedMethods).toEqual(["card"]);
  });
});
