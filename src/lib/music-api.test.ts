import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MusicSource, MusicTrack } from "@/types/music";
import { musicApi } from "./music-api";
import { MusicProviderFactory } from "./music-provider";
import { cachedFetch } from "@/lib/utils/cache";

vi.mock("./music-provider", () => ({
  isAbort: (e: unknown) => e instanceof Error && e.name === "AbortError",
  MusicProviderFactory: {
    getProvider: vi.fn(),
  },
}));

vi.mock("@/lib/utils/cache", () => ({
  cachedFetch: vi.fn(),
}));

const createTrack = (
  id: string,
  source: MusicSource,
  name = "Song",
  artist: string[] = ["Artist"]
): MusicTrack => ({
  id,
  name,
  artist,
  album: "Album",
  pic_id: `pic-${id}`,
  url_id: `url-${id}`,
  lyric_id: `lyric-${id}`,
  source,
});

describe("musicApi.searchBestMatch", () => {
  beforeEach(() => {
    vi.mocked(MusicProviderFactory.getProvider).mockReset();
  });

  it("keeps original item order when no ranker is provided", async () => {
    const first = createTrack("first", "joox");
    const second = createTrack("second", "joox");

    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      source: "joox",
      search: vi
        .fn()
        .mockResolvedValue({ items: [first, second], hasMore: false }),
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric: vi.fn(),
    });

    const match = await musicApi.searchBestMatch({
      query: "Song Artist",
      sources: ["joox"],
      predicate: () => true,
    });

    expect(match).toBe(first);
  });

  it("sorts matching items within a single source when ranker is provided", async () => {
    const weaker = createTrack("weaker", "joox", "Song", ["Artist"]);
    const stronger = createTrack("stronger", "joox", "Song", ["Artist"]);

    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      source: "joox",
      search: vi
        .fn()
        .mockResolvedValue({ items: [weaker, stronger], hasMore: false }),
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric: vi.fn(),
    });

    const match = await musicApi.searchBestMatch({
      query: "Song Artist",
      sources: ["joox"],
      predicate: () => true,
      ranker: (track) => (track.id === "stronger" ? 10 : 1),
    });

    expect(match).toBe(stronger);
  });
});

describe("musicApi local metadata", () => {
  beforeEach(() => {
    vi.mocked(MusicProviderFactory.getProvider).mockReset();
    vi.mocked(cachedFetch).mockReset();
    // 透传：直接执行 fetcher 并返回结果，跳过 Cache API
    vi.mocked(cachedFetch).mockImplementation(async (_key, fetcher) =>
      fetcher()
    );
  });

  it("loads local cover from the local provider via cachedFetch", async () => {
    const getPic = vi.fn().mockResolvedValue("data:image/jpeg;base64,abc");
    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      source: "joox",
      search: vi.fn(),
      getUrl: vi.fn(),
      getPic,
      getLyric: vi.fn(),
    });

    await expect(musicApi.getPic("/music/song.mp3", "local")).resolves.toBe(
      "data:image/jpeg;base64,abc"
    );
    expect(getPic).toHaveBeenCalledWith(
      { id: "/music/song.mp3", pic_id: "/music/song.mp3", source: "local" },
      800
    );
  });

  it("loads local lyrics from the local provider via cachedFetch", async () => {
    const getLyric = vi
      .fn()
      .mockResolvedValue({ lyric: "[00:00.00]歌词", tlyric: "" });
    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      source: "joox",
      search: vi.fn(),
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric,
    });

    await expect(
      musicApi.getLyric("/music/song.mp3", "local")
    ).resolves.toEqual({
      lyric: "[00:00.00]歌词",
      tlyric: "",
    });
    expect(getLyric).toHaveBeenCalledWith({
      id: "/music/song.mp3",
      lyric_id: "/music/song.mp3",
      source: "local",
    });
  });
});
