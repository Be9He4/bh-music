import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveTrackUrl } from "./audio-resolver";
import type { MusicTrack } from "@/types/music";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => true,
    convertFileSrc: (value: string) => `converted:${value}`,
  },
  registerPlugin: () => ({
    getLocalFileUrl: vi.fn(),
    getEmbeddedCover: vi.fn(),
    getEmbeddedLyrics: vi.fn(),
  }),
}));

vi.mock("@/plugins/local-music", () => ({
  LocalMusicPlugin: {
    getLocalFileUrl: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("@/store/download-store", () => ({
  useDownloadStore: { getState: () => ({ getUri: () => null }) },
}));
vi.mock("@/store/offline-store", () => ({
  useOfflineStore: { getState: () => ({ records: {} }) },
}));
vi.mock("@/store/url-cache-store", () => ({
  useUrlCacheStore: { getState: () => ({ get: () => null, set: vi.fn() }) },
  buildUrlCacheKey: () => "key",
}));
vi.mock("@/lib/music-api", () => ({
  musicApi: { getUrl: vi.fn() },
}));

import { LocalMusicPlugin } from "@/plugins/local-music";
import { musicApi } from "@/lib/music-api";

// 模拟 musicApi.getUrl 在本地音源时委托给 LocalProvider（convertFileSrc 已在上方 mock）
async function mockLocalGetUrl(_id: string, source: string) {
  if (source !== "local") return null;
  const res = await LocalMusicPlugin.getLocalFileUrl({
    localPath: "/storage/emulated/0/Music/song.mp3",
  });
  return res.success && res.url ? `converted:${res.url}` : null;
}

const localTrack: MusicTrack = {
  id: "local-1",
  name: "Song",
  artist: ["Artist"],
  album: "Album",
  pic_id: "/storage/emulated/0/Music/song.mp3",
  url_id: "/storage/emulated/0/Music/song.mp3",
  lyric_id: "/storage/emulated/0/Music/song.mp3",
  source: "local",
};

describe("resolveTrackUrl offline", () => {
  const originalOnLine = navigator.onLine;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      configurable: true,
    });
  });

  it("resolves local file URL even when offline (URL comes from disk)", async () => {
    vi.mocked(LocalMusicPlugin.getLocalFileUrl).mockResolvedValue({
      success: true,
      url: "/storage/emulated/0/Music/song.mp3",
    });
    vi.mocked(musicApi.getUrl).mockImplementation(mockLocalGetUrl);

    const result = await resolveTrackUrl(localTrack, 192);

    expect(result.url).toBe("converted:/storage/emulated/0/Music/song.mp3");
    expect(musicApi.getUrl).toHaveBeenCalled();
  });

  it("returns empty url offline for remote source with no cache", async () => {
    const remoteTrack: MusicTrack = {
      ...localTrack,
      id: "netease-1",
      source: "netease",
    };
    const result = await resolveTrackUrl(remoteTrack, 192);

    expect(result.url).toBe("");
    expect(musicApi.getUrl).not.toHaveBeenCalled();
  });
});
