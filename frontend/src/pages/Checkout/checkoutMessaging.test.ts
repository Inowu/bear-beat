import {
  buildCheckoutChargeSummary,
  buildCheckoutContinueLabel,
  buildCheckoutMethodCopy,
  hasVisibleTrialOffer,
  isTrialVisibleForMethod,
} from "./checkoutMessaging";

describe("checkout trial visibility", () => {
  it("shows trial offer for card when eligibility is unknown", () => {
    const trialConfig = { enabled: true, days: 7, gb: 100, eligible: null };
    const trialAllowedMethods = ["card", "paypal"] as const;

    expect(
      hasVisibleTrialOffer({
        trialConfig,
        trialAllowedMethods: [...trialAllowedMethods],
      }),
    ).toBe(true);

    expect(
      isTrialVisibleForMethod({
        trialConfig,
        method: "card",
        trialAllowedMethods: [...trialAllowedMethods],
      }),
    ).toBe(true);
  });

  it("hides trial when backend marks user as ineligible", () => {
    const trialConfig = { enabled: true, days: 7, gb: 100, eligible: false };

    expect(
      isTrialVisibleForMethod({
        trialConfig,
        method: "card",
        trialAllowedMethods: ["card"],
      }),
    ).toBe(false);
  });
});

describe("checkout copy per method", () => {
  it("builds trial-first copy for card", () => {
    const copy = buildCheckoutMethodCopy({
      method: "card",
      totalPrice: "350.00",
      currencyCode: "MXN",
      monthlyLabel: "$350.00 MXN/mes",
      trialDays: 7,
      trialGbLabel: "100",
      isMethodTrial: true,
    });

    expect(copy.summaryLine).toBe("Hoy: $0 (prueba 7 días + 100 GB)");
    expect(copy.detailLine).toBe("Después: $350 MXN/mes (si no cancelas)");
    expect(copy.trustLine).toContain("prueba");
  });

  it("builds pay-now copy for spei without trial", () => {
    const copy = buildCheckoutMethodCopy({
      method: "spei",
      totalPrice: "350.00",
      currencyCode: "MXN",
      monthlyLabel: "$350.00 MXN/mes",
      trialDays: 7,
      trialGbLabel: "100",
      isMethodTrial: false,
    });

    expect(copy.summaryLine).toBe("Pago hoy: $350 MXN");
    expect(copy.detailLine).toContain("SPEI");
    expect(copy.detailLine).toContain("Renovación manual desde Mi cuenta");
  });

  it("builds manual-renewal copy for cash payments", () => {
    const copy = buildCheckoutMethodCopy({
      method: "oxxo",
      totalPrice: "350.00",
      currencyCode: "MXN",
      monthlyLabel: "$350.00 MXN/mes",
      trialDays: 7,
      trialGbLabel: "100",
      isMethodTrial: false,
    });

    expect(copy.summaryLine).toBe("Pago hoy: $350 MXN");
    expect(copy.detailLine).toContain("Renovación manual desde Mi cuenta");
    expect(copy.trustLine).toContain("Renovación manual desde Mi cuenta");
  });
});

describe("checkout CTA labels", () => {
  it("uses trial CTA on card when trial applies", () => {
    const label = buildCheckoutContinueLabel({
      method: "card",
      processingMethod: null,
      totalPrice: "350.00",
      currencyCode: "MXN",
      isMethodTrial: true,
    });

    expect(label).toBe("Activar 7 días gratis");
  });

  it("uses pay-now CTA for non-card methods", () => {
    const label = buildCheckoutContinueLabel({
      method: "spei",
      processingMethod: null,
      totalPrice: "350.00",
      currencyCode: "MXN",
      isMethodTrial: false,
    });

    expect(label).toBe("Pagar $350");
  });
});

describe("checkout charge summary block", () => {
  it("shows trial-first totals for card trial", () => {
    const summary = buildCheckoutChargeSummary({
      method: "card",
      totalPrice: "350.00",
      currencyCode: "MXN",
      monthlyLabel: "$350.00 MXN/mes",
      trialDays: 7,
      trialGbLabel: "100",
      isMethodTrial: true,
      isAutoRenewMethod: true,
    });

    expect(summary.todayLabel).toBe("Hoy");
    expect(summary.todayValue).toContain("$0 (prueba 7 días + 100 GB)");
    expect(summary.afterLabel).toBe("Después");
    expect(summary.afterValue).toContain("$350 MXN/mes (si no cancelas)");
    expect(summary.accountLine).toContain("Mi cuenta");
  });

  it("shows manual renewal copy for spei", () => {
    const summary = buildCheckoutChargeSummary({
      method: "spei",
      totalPrice: "350.00",
      currencyCode: "MXN",
      monthlyLabel: "$350.00 MXN/mes",
      trialDays: 0,
      trialGbLabel: "0",
      isMethodTrial: false,
      isAutoRenewMethod: false,
    });

    expect(summary.todayLabel).toBe("Pago hoy");
    expect(summary.todayValue).toBe("$350 MXN");
    expect(summary.afterLabel).toBe("Renovación");
    expect(summary.afterValue).toContain("Renovación manual");
    expect(summary.accountLine).toContain("avisamos");
  });
});
