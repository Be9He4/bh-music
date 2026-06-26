import { describe, it, expect, vi } from "vitest";
import {
  parsePlaylistId,
  parsePlaylistRegion,
  convertToMusicTrack,
  type AppleMusicTrack,
} from "./apple-playlist-importer";
import type { MusicTrack } from "@/types/music";

// Mock useMusicStore
vi.mock("@/store/music-store", () => ({
  useMusicStore: {
    getState: () => ({
      createPlaylist: vi.fn(() => "test-playlist-id"),
      setPlaylistTracks: vi.fn(),
    }),
  },
}));

describe("parsePlaylistId", () => {
  it("should parse web URL format", () => {
    const url =
      "https://music.apple.com/cn/playlist/%E6%88%91%E7%9A%84%E6%AD%8C%E5%8D%95/pl.u-9N9L24qL8B0";
    const result = parsePlaylistId(url);
    expect(result).toBe("pl.u-9N9L24qL8B0");
  });

  it("should parse short URL format", () => {
    const url = "https://music.apple.com/pl.playlist.u-9N9L24qL8B0";
    const result = parsePlaylistId(url);
    expect(result).toBe("pl.playlist.u-9N9L24qL8B0");
  });

  it("should parse US web URL format", () => {
    const url =
      "https://music.apple.com/us/playlist/test-playlist/pl.1234567890abcdef";
    const result = parsePlaylistId(url);
    expect(result).toBe("pl.1234567890abcdef");
  });

  it("should return null for invalid URL", () => {
    const url = "https://music.apple.com/artist/test-artist/123456";
    const result = parsePlaylistId(url);
    expect(result).toBeNull();
  });

  it("should return null for non-Apple URL", () => {
    const url = "https://example.com/playlist/test";
    const result = parsePlaylistId(url);
    expect(result).toBeNull();
  });

  it("should return null for malformed URL", () => {
    const url = "not-a-valid-url";
    const result = parsePlaylistId(url);
    expect(result).toBeNull();
  });
});

describe("parsePlaylistRegion", () => {
  it("should extract cn region from web URL", () => {
    const url =
      "https://music.apple.com/cn/playlist/test-playlist/pl.1234567890abcdef";
    expect(parsePlaylistRegion(url)).toBe("cn");
  });

  it("should extract us region from web URL", () => {
    const url =
      "https://music.apple.com/us/playlist/test-playlist/pl.1234567890abcdef";
    expect(parsePlaylistRegion(url)).toBe("us");
  });

  it("should default to cn for short URL", () => {
    const url = "https://music.apple.com/pl.playlist.u-9N9L24qL8B0";
    expect(parsePlaylistRegion(url)).toBe("cn");
  });
});

describe("convertToMusicTrack", () => {
  it("should convert AppleMusicTrack to MusicTrack correctly", () => {
    const appleTrack: AppleMusicTrack = {
      id: "track-123",
      name: "Test Song",
      artist: "Test Artist",
      album: "Test Album",
      artworkUrl: "https://example.com/artwork.jpg",
    };

    const result = convertToMusicTrack(appleTrack);

    expect(result.id).toBe("apple_track-123");
    expect(result.name).toBe("Test Song");
    expect(result.artist).toEqual(["Test Artist"]);
    expect(result.album).toBe("Test Album");
    expect(result.pic_id).toBe("https://example.com/artwork.jpg");
    expect(result.url_id).toBe("track-123");
    expect(result.lyric_id).toBe("track-123");
    expect(result.source).toBe("apple");
    expect(result.is_deleted).toBe(false);
    expect(result.update_time).toBeDefined();
  });

  it("should handle missing artworkUrl", () => {
    const appleTrack: AppleMusicTrack = {
      id: "track-456",
      name: "Song Without Artwork",
      artist: "Artist Name",
      album: "Album Name",
    };

    const result = convertToMusicTrack(appleTrack);

    expect(result.pic_id).toBe("");
    expect(result.source).toBe("apple");
  });

  it("should handle special characters in track info", () => {
    const appleTrack: AppleMusicTrack = {
      id: "track-special-789",
      name: "Song & Artist (feat. Someone)",
      artist: "Artist & Co.",
      album: "Album: Special Edition",
      artworkUrl: "https://example.com/special.jpg",
    };

    const result = convertToMusicTrack(appleTrack);

    expect(result.id).toBe("apple_track-special-789");
    expect(result.name).toBe("Song & Artist (feat. Someone)");
    expect(result.artist).toEqual(["Artist & Co."]);
  });
});

describe("Apple Music Import Integration", () => {
  it("should have apple in MusicSource type", () => {
    // 验证 apple 是有效的 MusicSource
    const track: MusicTrack = {
      id: "apple_test",
      name: "Test",
      artist: ["Test Artist"],
      album: "Test Album",
      pic_id: "",
      url_id: "test",
      lyric_id: "test",
      source: "apple",
    };

    expect(track.source).toBe("apple");
  });
});
