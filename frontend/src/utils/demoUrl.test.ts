import { buildDemoPlaybackUrl } from "./demoUrl";

describe("demoUrl", () => {
  it("encodes each path segment so # is preserved as %23", () => {
    expect(
      buildDemoPlaybackUrl("/demos/ACDC #1 (Live).mp4", "https://thebearbeatapi.lat"),
    ).toBe("https://thebearbeatapi.lat/demos/ACDC%20%231%20(Live).mp4");
  });

  it("does not double-encode already encoded segments", () => {
    expect(
      buildDemoPlaybackUrl("/demos/ACDC%20%231%20(Live).mp4", "https://thebearbeatapi.lat"),
    ).toBe("https://thebearbeatapi.lat/demos/ACDC%20%231%20(Live).mp4");
  });

  it("normalizes slashes and supports missing leading slash", () => {
    expect(
      buildDemoPlaybackUrl("demos\\folder/track#demo.mp3", "https://thebearbeatapi.lat"),
    ).toBe("https://thebearbeatapi.lat/demos/folder/track%23demo.mp3");
  });
});
