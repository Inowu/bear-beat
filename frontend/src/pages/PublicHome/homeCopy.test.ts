import { describe, expect, it } from "vitest";
import {
  getHomeCtaPrimaryLabel,
  getHomeHeroFitPoints,
  getHomeHeroStats,
  getHomeHeroSubtitle,
  HOME_CTA_SECONDARY_LABEL,
} from "./homeCopy";

describe("homeCopy hero dynamic text", () => {
  it("formats total files in hero subtitle", () => {
    expect(getHomeHeroSubtitle(248897)).toContain("248,897 remixes listos");
  });

  it("falls back to generic subtitle lead when total files is unavailable", () => {
    expect(getHomeHeroSubtitle(0)).toContain("Remixes listos:");
  });

  it("builds fit points with dynamic genre count", () => {
    const [firstPoint] = getHomeHeroFitPoints(67);
    expect(firstPoint).toContain("67+ géneros latinos");
  });

  it("falls back to non-numeric genre lead when stats are unavailable", () => {
    const [firstPoint] = getHomeHeroFitPoints(0);
    expect(firstPoint).toContain("Géneros latinos");
  });

  it("builds hero stats with catalog counters and monthly pack cadence", () => {
    const [files, totalContent, genres, cadence] = getHomeHeroStats({
      totalFiles: 248897,
      totalTBLabel: "14+ TB",
      totalGenres: 67,
    });

    expect(files?.value).toBe("248,897");
    expect(totalContent?.value).toBe("14+ TB");
    expect(genres?.value).toBe("67+");
    expect(cadence?.value).toBe("4 packs");
    expect(cadence?.note).toBe("ACTUALIZACIONES SEMANALES");
  });

  it("returns trial-first label when trial is active", () => {
    expect(getHomeCtaPrimaryLabel({ enabled: true, days: 7 })).toBe(
      "Probar 7 días gratis",
    );
  });

  it("exposes the updated secondary CTA copy", () => {
    expect(HOME_CTA_SECONDARY_LABEL).toBe("Escuchar demos ↓");
  });
});
