import { describe, expect, it } from "vitest";

import type { LocalMusicFile } from "@/plugins/local-music";
import type { MusicTrack } from "@/types/music";
import { convertToMusicTrack } from "./download";
import { AUDIO_MIME, buildFileName } from "@/lib/storage-manager";
import { getCachedBilibiliAudioFormat } from "@/lib/bilibili/bilibili-cache";

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

describe("bilibili download format propagation", () => {
  it("buildFileName respects track.audioFormat from cache lookup helper", () => {
    const track: MusicTrack = {
      id: "bilibili_BV1xx411c7mD",
      name: "Test",
      artist: ["UP"],
      album: "",
      pic_id: "",
      url_id: "bilibili_BV1xx411c7mD",
      lyric_id: "",
      source: "bilibili",
    };

    // 没有 audioFormat 时，buildFileName fallback 到 mp3
    expect(buildFileName(track)).toBe("Test - UP.mp3");

    // 显式设置 audioFormat 后扩展名随之变化
    expect(buildFileName({ ...track, audioFormat: "m4s" })).toBe(
      "Test - UP.m4s"
    );
    expect(buildFileName({ ...track, audioFormat: "flv" })).toBe(
      "Test - UP.flv"
    );
  });

  it("AUDIO_MIME has correct mapping for each format", () => {
    expect(AUDIO_MIME.mp3).toBe("audio/mpeg");
    expect(AUDIO_MIME.m4s).toBe("audio/mp4");
    expect(AUDIO_MIME.m4a).toBe("audio/mp4");
    expect(AUDIO_MIME.flv).toBe("video/x-flv");
  });
});

describe("getCachedBilibiliAudioFormat", () => {
  it("returns undefined when cache is empty", () => {
    // 静态 module-level cache 状态依赖测试顺序，使用唯一 key 隔离
    const result = getCachedBilibiliAudioFormat({
      id: `__non_existent_${Date.now()}_${Math.random()}`,
      source: "bilibili",
    });
    expect(result).toBeUndefined();
  });
});
