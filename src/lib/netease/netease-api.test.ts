import { describe, expect, it } from "vitest";
import { mapSearchAlbums, mapSearchArtists } from "./netease-api";

describe("mapSearchAlbums", () => {
  it("过滤无 id / 无 name 的行，并映射出 artistName", () => {
    const result = mapSearchAlbums([
      { id: 1, name: "Midnights", artist: { name: "Taylor Swift" } },
      { id: 2, name: "Lover" },
      { id: 0, name: "NoId" },
      { id: 3, name: "" },
    ]);
    expect(result).toEqual([
      { id: 1, name: "Midnights", artistName: "Taylor Swift" },
      { id: 2, name: "Lover", artistName: "" },
    ]);
  });

  it("空输入返回空数组", () => {
    expect(mapSearchAlbums()).toEqual([]);
    expect(mapSearchAlbums(undefined)).toEqual([]);
  });
});

describe("mapSearchArtists", () => {
  it("过滤无 id / 无 name 的行，映射出 name", () => {
    const result = mapSearchArtists([
      { id: 10, name: "Taylor Swift" },
      { id: 11, name: "Ed Sheeran" },
      { id: 0, name: "NoId" },
    ]);
    expect(result).toEqual([
      { id: 10, name: "Taylor Swift" },
      { id: 11, name: "Ed Sheeran" },
    ]);
  });

  it("空输入返回空数组", () => {
    expect(mapSearchArtists()).toEqual([]);
  });
});
