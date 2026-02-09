import {
  formatGB,
  formatInt,
  formatTB,
  normalizeGenreDisplayName,
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

  it("normalizes common genre typos/accents for display", () => {
    expect(normalizeGenreDisplayName("Reguetton")).toBe("Reggaetón");
    expect(normalizeGenreDisplayName("Pop Ingles")).toBe("Pop Inglés");
  });

  it("normalizes search key (lowercase, no accents)", () => {
    expect(normalizeSearchKey("Reggaetón")).toBe("reggaeton");
  });
});

