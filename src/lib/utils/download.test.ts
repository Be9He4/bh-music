import { describe, expect, it } from "vitest";

import type { LocalMusicFile } from "@/plugins/local-music";
import { convertToMusicTrack } from "./download";

describe("convertToMusicTrack", () => {
  it("uses local path as embedded cover and lyric ids for local tracks", () => {
    const file: LocalMusicFile = {
      id: "1",
      name: "Song",
      artist: "Artist",
      album: "Album",
      duration: 180000,
      localPath: "/storage/emulated/0/Music/song.mp3",
      fileSize: 1024,
    };

    const track = convertToMusicTrack(file);

    expect(track.source).toBe("local");
    expect(track.pic_id).toBe(file.localPath);
    expect(track.lyric_id).toBe(file.localPath);
  });
});
