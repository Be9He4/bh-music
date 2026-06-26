import { beforeEach, describe, expect, it, vi } from "vitest";

import { LocalMusicPlugin } from "@/plugins/local-music";
import type { MusicTrack } from "@/types/music";
import { LocalProvider } from "./local-provider";

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

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

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

describe("LocalProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads embedded cover from the native local music plugin", async () => {
    vi.mocked(LocalMusicPlugin.getEmbeddedCover).mockResolvedValue({
      success: true,
      dataUrl: "data:image/jpeg;base64,abc",
    });

    await expect(new LocalProvider().getPic(localTrack)).resolves.toBe(
      "data:image/jpeg;base64,abc"
    );
    expect(LocalMusicPlugin.getEmbeddedCover).toHaveBeenCalledWith({
      localPath: localTrack.pic_id,
    });
  });

  it("loads embedded lyrics from the native local music plugin", async () => {
    vi.mocked(LocalMusicPlugin.getEmbeddedLyrics).mockResolvedValue({
      success: true,
      lyric: "[00:00.00]歌词",
    });

    await expect(new LocalProvider().getLyric(localTrack)).resolves.toEqual({
      lyric: "[00:00.00]歌词",
      tlyric: "",
    });
    expect(LocalMusicPlugin.getEmbeddedLyrics).toHaveBeenCalledWith({
      localPath: localTrack.lyric_id,
    });
  });

  it("returns null when embedded local metadata is unavailable", async () => {
    vi.mocked(LocalMusicPlugin.getEmbeddedCover).mockResolvedValue({
      success: false,
      error: "empty",
    });
    vi.mocked(LocalMusicPlugin.getEmbeddedLyrics).mockResolvedValue({
      success: true,
      lyric: "",
    });

    const provider = new LocalProvider();

    await expect(provider.getPic(localTrack)).resolves.toBeNull();
    await expect(provider.getLyric(localTrack)).resolves.toBeNull();
  });
});
