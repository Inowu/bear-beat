import { inferTrackMetadata, prettyMediaName } from "./fileMetadata";

describe("fileMetadata", () => {
  it("extracts bpm/key even when version suffix is present", () => {
    const parsed = inferTrackMetadata("Bad Bunny - Monaco 128 BPM 8A - Extended Mix.mp3");

    expect(parsed.artist).toBe("Bad Bunny");
    expect(parsed.title).toBe("Monaco");
    expect(parsed.displayName).toBe("Bad Bunny - Monaco");
    expect(parsed.bpm).toBe(128);
    expect(parsed.camelot).toBe("8A");
    expect(parsed.version).toBe("Extended Mix");
    expect(parsed.format).toBe("MP3");
  });

  it("extracts version after removing tempo/key suffix", () => {
    const parsed = inferTrackMetadata("Calvin Harris - Summer (Radio Edit) 128 8A.mp4");

    expect(parsed.artist).toBe("Calvin Harris");
    expect(parsed.title).toBe("Summer");
    expect(parsed.bpm).toBe(128);
    expect(parsed.camelot).toBe("8A");
    expect(parsed.version).toBe("Radio Edit");
    expect(parsed.format).toBe("MP4");
  });

  it("supports bracket versions", () => {
    const parsed = inferTrackMetadata("Fisher - Losing It [VIP].mp3");

    expect(parsed.artist).toBe("Fisher");
    expect(parsed.title).toBe("Losing It");
    expect(parsed.version).toBe("VIP");
  });

  it("normalizes underscores and removes extension", () => {
    expect(prettyMediaName("Artist__Track_Name.mp3")).toBe("Artist Track Name");
  });
});
