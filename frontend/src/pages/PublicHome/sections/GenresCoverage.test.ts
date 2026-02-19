import { describe, expect, it } from "vitest";
import { inferCoverageCategory } from "./GenresCoverage";

describe("GenresCoverage category inference", () => {
  it("keeps latin genres inside LATINOS", () => {
    expect(inferCoverageCategory("reggaeton")).toBe("latinos");
    expect(inferCoverageCategory("cumbia sonidera")).toBe("latinos");
    expect(inferCoverageCategory("pop latino")).toBe("latinos");
  });

  it("routes non-latin genres away from LATINOS", () => {
    expect(inferCoverageCategory("reggae")).toBe("international");
    expect(inferCoverageCategory("pop")).toBe("international");
    expect(inferCoverageCategory("twerk")).toBe("international");
  });

  it("places decade and retro labels in ESPECIALIDADES", () => {
    expect(inferCoverageCategory("80s")).toBe("specialties");
    expect(inferCoverageCategory("90 s")).toBe("specialties");
    expect(inferCoverageCategory("old school classics")).toBe("specialties");
  });
});
