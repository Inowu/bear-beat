import { describe, expect, it } from "vitest";
import {
  buildMarketingVariables,
  EMPTY_MARKETING_VARIABLES,
} from "./marketingSnapshot";

describe("buildMarketingVariables", () => {
  it("builds a full snapshot from public pricing config and weekly uploads", () => {
    const snapshot = buildMarketingVariables({
      pricingConfig: {
        ui: {
          stats: {
            totalFiles: 248897,
            totalTB: 14.27,
            quotaGbDefault: 500,
          },
        },
        plans: {
          mxn: { price: 350, gigas: 500 },
          usd: { price: 18, gigas: 500 },
        },
        trialConfig: {
          enabled: true,
          eligible: true,
          days: 7,
          gb: 100,
        },
        catalog: {
          totalGenres: 67,
          audios: 105718,
          videos: 143179,
          karaokes: 53239,
          genresDetail: [
            { name: "Reggaetón", files: 20000 },
            { name: "Cumbia", files: 12000 },
            { name: "Dembow", files: 6300 },
          ],
        },
      },
      weeklyUploads: {
        totalFiles: 372,
      },
    });

    expect(snapshot.TOTAL_FILES).toBe(248897);
    expect(snapshot.TOTAL_TB).toBe(14.27);
    expect(snapshot.TOTAL_GENRES).toBe(67);
    expect(snapshot.TOTAL_AUDIO).toBe(105718);
    expect(snapshot.TOTAL_VIDEO).toBe(143179);
    expect(snapshot.TOTAL_KARAOKE).toBe(53239);
    expect(snapshot.WEEKLY_NEW_FILES).toBe(372);
    expect(snapshot.PRICE_MXN).toBe(350);
    expect(snapshot.PRICE_USD).toBe(18);
    expect(snapshot.PRICE_PER_DAY_MXN).toBe(11.6);
    expect(snapshot.PRICE_PER_DAY_USD).toBe(0.6);
    expect(snapshot.TRIAL_DAYS).toBe(7);
    expect(snapshot.TRIAL_GB).toBe(100);
    expect(snapshot.MONTHLY_GB).toBe(500);
    expect(snapshot.TOP_GENRES).toEqual(["Reggaetón", "Cumbia", "Dembow"]);
    expect(snapshot.TRIAL_ELIGIBLE).toBe(true);
    expect(snapshot.MONTHLY_LABEL_DUAL).toContain("MXN $350/mes");
    expect(snapshot.MONTHLY_LABEL_DUAL).toContain("USD $18/mes");
  });

  it("returns empty-safe defaults when payload is missing", () => {
    const snapshot = buildMarketingVariables({});
    expect(snapshot).toEqual(EMPTY_MARKETING_VARIABLES);
  });
});

