import { describe, expect, it } from "vitest";
import {
  buildSignUpCheckoutChargeCopy,
  mapPrecheckTrialToConfig,
  shouldShowSignUpCheckoutTrial,
} from "./signupCheckoutSummary";

describe("signupCheckoutSummary", () => {
  it("shows trial-first charge copy with Hoy $0 and Después when trial is visible", () => {
    const trialConfig = {
      enabled: true,
      days: 7,
      gb: 100,
      eligible: null,
    };
    const showCheckoutTrial = shouldShowSignUpCheckoutTrial({
      trialConfig,
      intentAllowsTrial: true,
    });
    const copy = buildSignUpCheckoutChargeCopy({
      showCheckoutTrial,
      trialConfig,
      checkoutPlanPriceLabel: "$18",
    });

    expect(showCheckoutTrial).toBe(true);
    expect(copy.summaryPrimary).toBe("Hoy $0");
    expect(copy.todayValue).toContain("$0 (prueba 7 días + 100 GB)");
    expect(copy.afterValue).toBe("$18/mes (si no cancelas)");
  });

  it("hides trial when checkout intent is a non-card rail", () => {
    const trialConfig = {
      enabled: true,
      days: 7,
      gb: 100,
      eligible: null,
    };
    const showCheckoutTrial = shouldShowSignUpCheckoutTrial({
      trialConfig,
      intentAllowsTrial: false,
    });
    const copy = buildSignUpCheckoutChargeCopy({
      showCheckoutTrial,
      trialConfig,
      checkoutPlanPriceLabel: "$18",
    });

    expect(showCheckoutTrial).toBe(false);
    expect(copy.summaryPrimary).toBe("Pago hoy $18");
    expect(copy.todayValue).toBe("$18");
  });

  it("keeps precheckTrial as fallback trial config when public pricing is unavailable", () => {
    const precheckTrial = {
      enabled: true,
      days: 7,
      gb: 100,
      trialState: "unknown_for_new" as const,
      accountState: "new" as const,
    };

    const fallbackTrialConfig = mapPrecheckTrialToConfig(precheckTrial);

    expect(fallbackTrialConfig).toEqual({
      enabled: true,
      days: 7,
      gb: 100,
      eligible: null,
    });
    expect(
      shouldShowSignUpCheckoutTrial({
        trialConfig: fallbackTrialConfig,
        intentAllowsTrial: true,
      }),
    ).toBe(true);
  });
});
