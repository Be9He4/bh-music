import { describe, expect, it, vi, beforeEach } from "vitest";
import type { MusicSource, MusicTrack } from "@/types/music";
import { musicApi } from "./music-api";
import { MusicProviderFactory } from "./music-provider";

vi.mock("./music-provider", () => ({
  isAbort: (e: unknown) => e instanceof Error && e.name === "AbortError",
  MusicProviderFactory: {
    getProvider: vi.fn(),
  },
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
      search: vi
        .fn()
        .mockResolvedValue({ items: [first, second], hasMore: false }),
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric: vi.fn(),
    });

    const match = await musicApi.searchBestMatch(
      "Song Artist",
      ["joox"],
      () => true,
      5
    );

    expect(match).toBe(first);
  });

  it("sorts matching items within a single source when ranker is provided", async () => {
    const weaker = createTrack("weaker", "joox", "Song", ["Artist"]);
    const stronger = createTrack("stronger", "joox", "Song", ["Artist"]);

    vi.mocked(MusicProviderFactory.getProvider).mockReturnValue({
      search: vi
        .fn()
        .mockResolvedValue({ items: [weaker, stronger], hasMore: false }),
      getUrl: vi.fn(),
      getPic: vi.fn(),
      getLyric: vi.fn(),
    });

    const match = await musicApi.searchBestMatch(
      "Song Artist",
      ["joox"],
      () => true,
      5,
      undefined,
      (track) => (track.id === "stronger" ? 10 : 1)
    );

    expect(match).toBe(stronger);
  });
});
