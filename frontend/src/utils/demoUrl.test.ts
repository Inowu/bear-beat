import { buildDemoPlaybackUrl, buildMemberPlaybackUrl } from "./demoUrl";

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

  it("supports absolute CDN demo URLs", () => {
    expect(
      buildDemoPlaybackUrl("https://media.thebearbeat.com/demos/demo #1.mp4", "https://thebearbeatapi.lat"),
    ).toBe("https://media.thebearbeat.com/demos/demo%20%231.mp4");
  });

  it("builds a secure member stream url using path and token query params", () => {
    expect(
      buildMemberPlaybackUrl("/Audios/ACDC #1 (Live).mp3", "abc.123.token", "https://thebearbeatapi.lat"),
    ).toBe(
      "https://thebearbeatapi.lat/stream?path=Audios%2FACDC+%231+%28Live%29.mp3&token=abc.123.token",
    );
  });

  it("normalizes already-encoded member paths without double-encoding", () => {
    expect(
      buildMemberPlaybackUrl("Audios/ACDC%20%231%20(Live).mp3", "abc.123.token", "https://thebearbeatapi.lat"),
    ).toBe(
      "https://thebearbeatapi.lat/stream?path=Audios%2FACDC+%231+%28Live%29.mp3&token=abc.123.token",
    );
  });
});
