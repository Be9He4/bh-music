import { describe, expect, it } from "vitest";
import { getCanonicalShareUrl } from "./share-url";
import type { MusicTrack } from "@/types/music";

function track(overrides: Partial<MusicTrack> = {}): MusicTrack {
  return {
    id: "test-id",
    name: "Test Song",
    artist: ["Test Artist"],
    album: "Test Album",
    pic_id: "",
    url_id: "test-id",
    lyric_id: "",
    source: "netease",
    ...overrides,
  };
}

describe("getCanonicalShareUrl", () => {
  it("generates bilibili video URL", () => {
    const url = getCanonicalShareUrl(
      track({ id: "bilibili_BV1xx411c7mD", source: "bilibili" })
    );
    expect(url).toBe("https://www.bilibili.com/video/BV1xx411c7mD");
  });

  it("handles bilibili id without prefix", () => {
    const url = getCanonicalShareUrl(
      track({ id: "BV1xx411c7mD", source: "bilibili" })
    );
    expect(url).toBe("https://www.bilibili.com/video/BV1xx411c7mD");
  });

  it("returns null for non-bilibili sources (falls back to audio URL)", () => {
    expect(getCanonicalShareUrl(track({ source: "netease" }))).toBeNull();
    expect(getCanonicalShareUrl(track({ source: "_netease" }))).toBeNull();
    expect(getCanonicalShareUrl(track({ source: "kuwo" }))).toBeNull();
    expect(getCanonicalShareUrl(track({ source: "migu" }))).toBeNull();
    expect(getCanonicalShareUrl(track({ source: "joox" }))).toBeNull();
    expect(getCanonicalShareUrl(track({ source: "local" }))).toBeNull();
    expect(getCanonicalShareUrl(track({ source: "podcast" }))).toBeNull();
  });
});
