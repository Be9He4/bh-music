import { describe, expect, it } from "vitest";
import { MusicProviderFactory } from "./factory";
import { MusicTrack } from "@/types/music";

const kugouTrack: MusicTrack = {
  id: "kugou_ABC",
  name: "测试歌曲",
  artist: ["测试歌手"],
  album: "测试专辑",
  pic_id: "https://example.com/cover.jpg",
  url_id: "ABC",
  lyric_id: "",
  source: "kugou",
};

const miguTrack: MusicTrack = {
  id: "migu_60054704083_600908000006663347",
  name: "测试歌曲",
  artist: ["测试歌手"],
  album: "测试专辑",
  pic_id: "https://example.com/migu-cover.jpg",
  url_id: "migu_60054704083_600908000006663347",
  lyric_id: "",
  source: "migu",
};

describe("MusicProviderFactory", () => {
  it("creates a safe placeholder provider for Kugou tracks", async () => {
    const provider = MusicProviderFactory.getProvider("kugou");

    await expect(provider.search("测试", 1, 20)).resolves.toEqual({ items: [], hasMore: false });
    await expect(provider.getUrl(kugouTrack)).resolves.toBeNull();
    await expect(provider.getPic(kugouTrack)).resolves.toBe("https://example.com/cover.jpg");
    await expect(provider.getLyric(kugouTrack)).resolves.toBeNull();
  });

  it("creates a provider for Migu tracks", async () => {
    const provider = MusicProviderFactory.getProvider("migu");

    await expect(provider.search("测试", 1, 20)).resolves.toEqual({ items: [], hasMore: false });
    await expect(provider.getPic(miguTrack)).resolves.toBe("https://example.com/migu-cover.jpg");
    await expect(provider.getLyric(miguTrack)).resolves.toBeNull();
  });
});
