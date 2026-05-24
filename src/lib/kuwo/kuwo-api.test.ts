import { describe, expect, it } from "vitest";
import {
  buildKuwoPlaylistApiPath,
  convertKuwoSongToMusicTrack,
  fetchKuwoPlaylistDetail,
  parseKuwoPlaylistResponse,
  parseKuwoPlaylistUrl,
} from "./kuwo-api";

describe("parseKuwoPlaylistUrl", () => {
  it("extracts playlist id from PC links", () => {
    expect(parseKuwoPlaylistUrl("https://www.kuwo.cn/playlist_detail/2410926933")).toBe("2410926933");
  });

  it("extracts playlist id from mobile links", () => {
    expect(parseKuwoPlaylistUrl("http://m.kuwo.cn/newh5app/playlist_detail/2410926933")).toBe("2410926933");
  });

  it("extracts playlist id from query links", () => {
    expect(parseKuwoPlaylistUrl("https://www.kuwo.cn/share?pid=2410926933")).toBe("2410926933");
  });

  it("rejects invalid links", () => {
    expect(parseKuwoPlaylistUrl("https://www.kuwo.cn/play_detail/123")).toBeNull();
    expect(parseKuwoPlaylistUrl("not a url")).toBeNull();
  });
});

describe("buildKuwoPlaylistApiPath", () => {
  it("builds the public playlist endpoint", () => {
    const path = buildKuwoPlaylistApiPath("2410926933", 0, 50);
    expect(path).toContain("/pl.svc?");
    expect(path).toContain("op=getlistinfo");
    expect(path).toContain("pid=2410926933");
    expect(path).toContain("pn=0");
    expect(path).toContain("rn=50");
    expect(path).toContain("encode=utf-8");
  });
});

describe("parseKuwoPlaylistResponse", () => {
  it("parses JSON responses", () => {
    const result = parseKuwoPlaylistResponse('{"result":"ok","title":"歌单","musiclist":[]}');
    expect(result.result).toBe("ok");
    expect(result.title).toBe("歌单");
  });
});

describe("convertKuwoSongToMusicTrack", () => {
  it("converts Kuwo songs to MusicTrack", () => {
    const track = convertKuwoSongToMusicTrack({
      id: "12442905",
      name: "Alone",
      artist: "Alan Walker",
      album: "Alone",
      albumid: "1364604",
      albumpic: "http://img3.kuwo.cn/star/albumcover/120/33/46/2029864975.jpg",
    });

    expect(track).toMatchObject({
      id: "kuwo_12442905",
      name: "Alone",
      artist: ["Alan Walker"],
      album: "Alone",
      pic_id: "https://img3.kuwo.cn/star/albumcover/120/33/46/2029864975.jpg",
      url_id: "12442905",
      lyric_id: "12442905",
      source: "kuwo",
      album_id: "1364604",
    });
  });

  it("splits multiple artists", () => {
    const track = convertKuwoSongToMusicTrack({
      musicrid: "MUSIC_1",
      name: "Song",
      artist: "A&B/ C",
    });

    expect(track.artist).toEqual(["A", "B", "C"]);
  });
});

describe("fetchKuwoPlaylistDetail", () => {
  it("fetches playlist detail from public endpoint", async () => {
    const detail = await fetchKuwoPlaylistDetail("2410926933", async (path) => {
      expect(path).toContain("pid=2410926933");
      return JSON.stringify({
        result: "ok",
        title: "电子歌单",
        pic: "http://img1.kwcdn.kuwo.cn/cover.jpg",
        total: 2,
        musiclist: [{ id: "1", name: "A" }, { id: "2", name: "B" }],
      });
    });

    expect(detail).toMatchObject({
      name: "电子歌单",
      coverUrl: "https://img1.kwcdn.kuwo.cn/cover.jpg",
      trackCount: 2,
    });
    expect(detail.songs).toHaveLength(2);
  });

  it("fetches additional pages until total is reached", async () => {
    const detail = await fetchKuwoPlaylistDetail("2410926933", async (path) => {
      if (path.includes("pn=0")) {
        return JSON.stringify({
          result: "ok",
          title: "电子歌单",
          total: 2,
          musiclist: [{ id: "1", name: "A" }],
        });
      }
      return JSON.stringify({
        result: "ok",
        title: "电子歌单",
        total: 2,
        musiclist: [{ id: "2", name: "B" }],
      });
    });

    expect(detail.trackCount).toBe(2);
    expect(detail.songs).toHaveLength(2);
  });

  it("throws for empty playlists", async () => {
    await expect(
      fetchKuwoPlaylistDetail("1", async () => JSON.stringify({ result: "ok", musiclist: [] }))
    ).rejects.toThrow("歌单为空");
  });
});
