import {
  formatCatalogSizeMarketing,
  formatGB,
  formatInt,
  formatTB,
  isSingleLetterGenreLabel,
  normalizeGenreDisplayName,
  normalizeGenreGroupingKey,
  normalizeSearchKey,
} from "./homeFormat";

describe("PublicHome formatting utils", () => {
  it("formats integers with es-MX grouping", () => {
    expect(formatInt(202_563)).toBe("202,563");
  });

  it("formats TB with fixed 2 decimals", () => {
    expect(formatTB(12.62)).toBe("12.62 TB");
  });

  it("formats GB with fixed 1 decimal", () => {
    expect(formatGB(1129.58)).toBe("1,129.6 GB");
  });

  it("formats catalog TB copy as stable floor-plus label", () => {
    expect(formatCatalogSizeMarketing(14.19)).toBe("14+ TB");
  });

  it("uses minimum floor when catalog value is unavailable", () => {
    expect(formatCatalogSizeMarketing(0)).toBe("14+ TB");
  });

  it("normalizes common genre typos/accents for display", () => {
    expect(normalizeGenreDisplayName("Reguetton")).toBe("Reggaetón");
    expect(normalizeGenreDisplayName("Pop Ingles")).toBe("Pop Inglés");
    expect(normalizeGenreDisplayName("80's")).toBe("80s");
  });

  it("normalizes search key (lowercase, no accents)", () => {
    expect(normalizeSearchKey("Reggaetón")).toBe("reggaeton");
  });

  it("identifies one-letter labels so they can be filtered from home genres", () => {
    expect(isSingleLetterGenreLabel("A")).toBe(true);
    expect(isSingleLetterGenreLabel("ñ")).toBe(true);
    expect(isSingleLetterGenreLabel("R&B")).toBe(false);
    expect(isSingleLetterGenreLabel("Cumbia")).toBe(false);
  });

  it("normalizes grouping keys to collapse home duplicates", () => {
    expect(normalizeGenreGroupingKey("80's")).toBe("80s");
    expect(normalizeGenreGroupingKey("80s")).toBe("80s");
    expect(normalizeGenreGroupingKey("Pop Latino")).toBe("pop latino");
    expect(normalizeGenreGroupingKey("Latino Pop")).toBe("pop latino");
  });
});
