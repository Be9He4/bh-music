import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resolveTrackUrl } from "./audio-resolver";
import type { OfflineTrackRecord } from "@/store/offline-store";
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

const { urlCacheMock, offlineMock } = vi.hoisted(() => ({
  urlCacheMock: {
    get: vi.fn<() => string | null>(() => null),
    set: vi.fn(),
    delete: vi.fn(),
  },
  offlineMock: {
    records: {} as Record<string, unknown>,
    addRecord: vi.fn(),
  },
}));

vi.mock("@/store/offline-store", () => ({
  useOfflineStore: { getState: () => offlineMock },
}));
vi.mock("@/store/url-cache-store", () => ({
  useUrlCacheStore: { getState: () => urlCacheMock },
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

describe("resolveTrackUrl forceRefresh", () => {
  const originalOnLine = navigator.onLine;
  const remoteTrack: MusicTrack = {
    ...localTrack,
    id: "netease-1",
    source: "netease",
  };

  const streamCacheRecord: OfflineTrackRecord = {
    trackId: "netease-1",
    source: "stream-cache",
    url: "https://cdn.example.com/stream-cached.mp3",
    cachedAt: Date.now(),
    name: "Song",
    artist: ["Artist"],
    album: "Album",
    trackSource: "netease",
    url_id: "netease-1",
    pic_id: "",
    lyric_id: "",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    urlCacheMock.get.mockReset();
    urlCacheMock.get.mockReturnValue(null);
    offlineMock.records = {};
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      value: originalOnLine,
      configurable: true,
    });
  });

  it("uses cached URL by default without re-requesting", async () => {
    urlCacheMock.get.mockReturnValue("https://cdn.example.com/stale.mp3");
    vi.mocked(musicApi.getUrl).mockResolvedValue(
      "https://cdn.example.com/new.mp3"
    );

    const result = await resolveTrackUrl(remoteTrack, 192);

    expect(result.url).toBe("https://cdn.example.com/stale.mp3");
    expect(musicApi.getUrl).not.toHaveBeenCalled();
  });

  it("forceRefresh bypasses cache, deletes stale entry and re-requests", async () => {
    urlCacheMock.get.mockReturnValue("https://cdn.example.com/stale.mp3");
    vi.mocked(musicApi.getUrl).mockResolvedValue(
      "https://cdn.example.com/new.mp3"
    );

    const result = await resolveTrackUrl(remoteTrack, 192, {
      forceRefresh: true,
    });

    expect(result.url).toBe("https://cdn.example.com/new.mp3");
    expect(urlCacheMock.delete).toHaveBeenCalledWith("key");
    expect(urlCacheMock.set).toHaveBeenCalledWith(
      "key",
      "https://cdn.example.com/new.mp3"
    );
    expect(musicApi.getUrl).toHaveBeenCalledWith("netease-1", "netease", 192, {
      forceRefresh: true,
    });
  });

  it("forceRefresh skips stale stream-cache offline record", async () => {
    offlineMock.records = { "netease-1": streamCacheRecord };
    vi.mocked(musicApi.getUrl).mockResolvedValue(
      "https://cdn.example.com/new.mp3"
    );

    const result = await resolveTrackUrl(remoteTrack, 192, {
      forceRefresh: true,
    });

    expect(result.url).toBe("https://cdn.example.com/new.mp3");
    expect(musicApi.getUrl).toHaveBeenCalled();
  });

  it("forceRefresh rewrites stream-cache offline record with fresh url", async () => {
    offlineMock.records = { "netease-1": streamCacheRecord };
    vi.mocked(musicApi.getUrl).mockResolvedValue(
      "https://cdn.example.com/new.mp3"
    );

    await resolveTrackUrl(remoteTrack, 192, { forceRefresh: true });

    expect(offlineMock.addRecord).toHaveBeenCalledWith({
      ...streamCacheRecord,
      url: "https://cdn.example.com/new.mp3",
      cachedAt: expect.any(Number),
    });
  });

  it("does not rewrite stream-cache record without forceRefresh", async () => {
    offlineMock.records = { "netease-1": streamCacheRecord };

    await resolveTrackUrl(remoteTrack, 192);

    expect(offlineMock.addRecord).not.toHaveBeenCalled();
  });

  it("reuses stream-cache offline record without forceRefresh", async () => {
    offlineMock.records = { "netease-1": streamCacheRecord };

    const result = await resolveTrackUrl(remoteTrack, 192);

    expect(result.url).toBe("https://cdn.example.com/stream-cached.mp3");
    expect(musicApi.getUrl).not.toHaveBeenCalled();
  });
});
