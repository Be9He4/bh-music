import { describe, expect, it } from "vitest";
import { AUDIO_MIME, buildFileName } from "./storage-manager";
import type { MusicTrack } from "@/types/music";

const baseTrack: Pick<MusicTrack, "id" | "name" | "artist" | "source"> = {
  id: "1",
  name: "歌名",
  artist: ["艺术家"],
  source: "netease",
};

describe("buildFileName", () => {
  it("uses mp3 extension when audioFormat is missing", () => {
    expect(
      buildFileName({ ...baseTrack, audioFormat: undefined } as MusicTrack)
    ).toBe("歌名 - 艺术家.mp3");
  });

  it("uses m4s extension for B 站 DASH tracks", () => {
    expect(
      buildFileName({ ...baseTrack, audioFormat: "m4s" } as MusicTrack)
    ).toBe("歌名 - 艺术家.m4s");
  });

  it("uses flv extension for durl fallback", () => {
    expect(
      buildFileName({ ...baseTrack, audioFormat: "flv" } as MusicTrack)
    ).toBe("歌名 - 艺术家.flv");
  });

  it("uses m4a extension", () => {
    expect(
      buildFileName({ ...baseTrack, audioFormat: "m4a" } as MusicTrack)
    ).toBe("歌名 - 艺术家.m4a");
  });

  it("falls back to Unknown when artist is empty", () => {
    expect(
      buildFileName({
        ...baseTrack,
        artist: [],
        audioFormat: "m4s",
      } as unknown as MusicTrack)
    ).toBe("歌名 - Unknown.m4s");
  });

  it("joins multiple artists with &", () => {
    expect(
      buildFileName({
        ...baseTrack,
        artist: ["A", "B", "C"],
        audioFormat: "m4s",
      } as MusicTrack)
    ).toBe("歌名 - A & B & C.m4s");
  });

  it("sanitizes filesystem-unsafe characters", () => {
    expect(
      buildFileName({
        ...baseTrack,
        name: 'a/b\\c:d?e"f*<g>|h',
        artist: ["x"],
        audioFormat: "m4s",
      } as MusicTrack)
    ).toBe("a b c d e f g h - x.m4s");
  });
});

describe("AUDIO_MIME", () => {
  it("maps mp3 to audio/mpeg", () => {
    expect(AUDIO_MIME.mp3).toBe("audio/mpeg");
  });

  it("maps m4a and m4s to audio/mp4", () => {
    expect(AUDIO_MIME.m4a).toBe("audio/mp4");
    expect(AUDIO_MIME.m4s).toBe("audio/mp4");
  });

  it("maps flv to video/x-flv", () => {
    expect(AUDIO_MIME.flv).toBe("video/x-flv");
  });
});
