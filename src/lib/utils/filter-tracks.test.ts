import { describe, expect, it } from "vitest";
import { filterTracks } from "./filter-tracks";
import type { MusicTrack } from "@/types/music";

const t = (overrides: Partial<MusicTrack> = {}): MusicTrack => ({
  id: "id",
  name: "Song",
  artist: ["Artist"],
  album: "Album",
  pic_id: "",
  url_id: "",
  lyric_id: "",
  source: "netease",
  ...overrides,
});

describe("filterTracks", () => {
  const tracks = [
    t({ id: "1", name: "Hello World", artist: ["Alice"], album: "Debut" }),
    t({ id: "2", name: "Goodbye", artist: ["Bob"], album: "Farewell" }),
    t({
      id: "3",
      name: "Midnight",
      artist: ["Alice", "Charlie"],
      album: "Midnight",
    }),
  ];

  it("returns all tracks when query is empty", () => {
    expect(filterTracks(tracks, "")).toEqual(tracks);
    expect(filterTracks(tracks, "   ")).toEqual(tracks);
  });

  it("filters by track name (case-insensitive)", () => {
    expect(filterTracks(tracks, "hello")).toEqual([tracks[0]]);
    expect(filterTracks(tracks, "HELLO")).toEqual([tracks[0]]);
    expect(filterTracks(tracks, "mid")).toEqual([tracks[2]]);
  });

  it("filters by artist name (case-insensitive)", () => {
    expect(filterTracks(tracks, "alice")).toEqual([tracks[0], tracks[2]]);
    expect(filterTracks(tracks, "bob")).toEqual([tracks[1]]);
    expect(filterTracks(tracks, "charlie")).toEqual([tracks[2]]);
  });

  it("filters by album name (case-insensitive)", () => {
    expect(filterTracks(tracks, "debut")).toEqual([tracks[0]]);
    expect(filterTracks(tracks, "FAREWELL")).toEqual([tracks[1]]);
  });

  it("returns empty array when no tracks match", () => {
    expect(filterTracks(tracks, "nonexistent")).toEqual([]);
  });

  it("handles empty tracks array", () => {
    expect(filterTracks([], "hello")).toEqual([]);
  });

  it("handles tracks with missing optional fields", () => {
    const partialTracks = [
      t({ id: "4", name: "No Artist", artist: undefined, album: undefined }),
      t({ id: "5", name: "Has Album", artist: undefined, album: "Some Album" }),
    ];
    expect(filterTracks(partialTracks, "artist")).toEqual([partialTracks[0]]);
    expect(filterTracks(partialTracks, "some")).toEqual([partialTracks[1]]);
    expect(filterTracks(partialTracks, "no")).toEqual([partialTracks[0]]);
  });
});
