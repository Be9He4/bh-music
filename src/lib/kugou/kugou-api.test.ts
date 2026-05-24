import { describe, expect, it, vi } from "vitest";
import {
  buildKugouAndroidSignedUrl,
  buildKugouGlobalPlaylistSongsUrl,
  buildKugouPlaylistApiPath,
  convertKugouSongToMusicTrack,
  fetchKugouGlobalPlaylistPages,
  fetchKugouPlaylistPages,
  parseKugouPlaylistTitle,
  parseKugouPlaylistResponse,
  parseKugouPlaylistUrl,
} from "./kugou-api";

describe("parseKugouPlaylistUrl", () => {
  it("extracts playlist id from PC links", () => {
    expect(parseKugouPlaylistUrl("https://www.kugou.com/yy/special/single/6222311.html")).toBe("6222311");
  });

  it("extracts playlist id from mobile links", () => {
    expect(parseKugouPlaylistUrl("https://m.kugou.com/plist/list/6222311")).toBe("6222311");
  });

  it("extracts global collection id from new songlist links", () => {
    expect(parseKugouPlaylistUrl("https://m.kugou.com/songlist/gcid_3z11ahgl0z6z0dc/")).toBe("gcid_3z11ahgl0z6z0dc");
    expect(parseKugouPlaylistUrl("https://www.kugou.com/songlist/gcid_3z11ahgl0z6z0dc/")).toBe("gcid_3z11ahgl0z6z0dc");
    expect(parseKugouPlaylistUrl("https://m.kugou.com/songlist/?global_collection_id=gcid_3z11ahgl0z6z0dc")).toBe("gcid_3z11ahgl0z6z0dc");
  });

  it("rejects invalid links", () => {
    expect(parseKugouPlaylistUrl("https://www.kugou.com/song/#hash=abc")).toBeNull();
    expect(parseKugouPlaylistUrl("not a url")).toBeNull();
  });
});

describe("buildKugouPlaylistApiPath", () => {
  it("builds the public playlist song endpoint", () => {
    const path = buildKugouPlaylistApiPath("6222311", 2, 50);
    expect(path).toContain("/api/v3/special/song?");
    expect(path).toContain("specialid=6222311");
    expect(path).toContain("page=2");
    expect(path).toContain("pagesize=50");
  });
});

describe("buildKugouAndroidSignedUrl", () => {
  it("builds stable Android signed URLs", () => {
    const url = buildKugouAndroidSignedUrl(
      "https://gateway.kugou.com/v3/get_list_info",
      {
        appid: 1005,
        clienttime: 1700000000,
        clientver: 20489,
        dfid: "-",
        mid: "undefined",
        uuid: "-",
        global_collection_id: "gcid_3z11ahgl0z6z0dc",
      },
      "body",
    );

    expect(url).toContain("global_collection_id=gcid_3z11ahgl0z6z0dc");
    expect(url).toContain("signature=483890b2c75090e1cc5d0c93f6b96edc");
  });
});

describe("buildKugouGlobalPlaylistSongsUrl", () => {
  it("builds the global collection playlist song endpoint", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2023-11-14T22:13:20Z"));

    const url = buildKugouGlobalPlaylistSongsUrl("gcid_3z11ahgl0z6z0dc", 2, 50);

    expect(url).toContain("https://gateway.kugou.com/pubsongs/v2/get_other_list_file_nofilt?");
    expect(url).toContain("global_collection_id=gcid_3z11ahgl0z6z0dc");
    expect(url).toContain("begin_idx=50");
    expect(url).toContain("pagesize=50");
    expect(url).toContain("clienttime=1700000000");

    vi.useRealTimers();
  });
});

describe("parseKugouPlaylistResponse", () => {
  it("parses wrapped JSON responses", () => {
    const result = parseKugouPlaylistResponse('<!--KG_TAG_RES_START-->{"status":1,"errcode":0,"data":{"info":[]}}<!--KG_TAG_RES_END-->');
    expect(result.status).toBe(1);
    expect(result.errcode).toBe(0);
  });
});

describe("parseKugouPlaylistTitle", () => {
  it("extracts title from keywords meta", () => {
    const html = '<meta name="keywords" content="酷狗正式版,随便听听就好了,歌曲下载" />';
    expect(parseKugouPlaylistTitle(html)).toBe("随便听听就好了");
  });

  it("falls back to page title", () => {
    expect(parseKugouPlaylistTitle("<title>我的歌单_精选集_乐库频道_酷狗网</title>")).toBe("我的歌单");
  });
});

describe("convertKugouSongToMusicTrack", () => {
  it("converts Kugou songs to MusicTrack", () => {
    const track = convertKugouSongToMusicTrack({
      hash: "ABC",
      songname: "哭泣站台 (氛围合唱版)",
      album_name: "倒马倒马",
      authors: [{ author_name: "GRABOTE" }],
      trans_param: { union_cover: "http://imge.kugou.com/stdmusic/{size}/cover.jpg" },
    });

    expect(track).toMatchObject({
      id: "kugou_ABC",
      name: "哭泣站台 (氛围合唱版)",
      artist: ["GRABOTE"],
      album: "倒马倒马",
      pic_id: "http://imge.kugou.com/stdmusic/300/cover.jpg",
      source: "kugou",
    });
  });

  it("falls back to filename fields", () => {
    const track = convertKugouSongToMusicTrack({
      HASH: "DEF",
      filename: "庄东茹、DJ豪大大 - 又活了一天",
    });

    expect(track.name).toBe("又活了一天");
    expect(track.artist).toEqual(["庄东茹", "DJ豪大大"]);
  });
});

describe("fetchKugouPlaylistPages", () => {
  it("fetches all pages until total is reached", async () => {
    const detail = await fetchKugouPlaylistPages("6222311", async (path) => {
      if (path.includes("page=1")) {
        return JSON.stringify({
          status: 1,
          errcode: 0,
          data: { total: 2, info: [{ hash: "A", songname: "A" }] },
        });
      }
      return JSON.stringify({
        status: 1,
        errcode: 0,
        data: { total: 2, info: [{ hash: "B", songname: "B" }] },
      });
    });

    expect(detail.trackCount).toBe(2);
    expect(detail.songs).toHaveLength(2);
  });
});

describe("fetchKugouGlobalPlaylistPages", () => {
  it("fetches global collection playlist pages", async () => {
    const detail = await fetchKugouGlobalPlaylistPages(
      "gcid_3z11ahgl0z6z0dc",
      async (url) => {
        if (url.includes("begin_idx=0")) {
          return JSON.stringify({
            status: 1,
            data: {
              total: 2,
              info: [
                {
                  hash: "A",
                  songname: "A",
                  trans_param: { union_cover: "http://imge.kugou.com/stdmusic/{size}/cover.jpg" },
                },
              ],
            },
          });
        }
        return JSON.stringify({
          status: 1,
          data: { total: 2, info: [{ hash: "B", songname: "B" }] },
        });
      },
      async () =>
        JSON.stringify({
          status: 1,
          data: [{ name: "新版歌单", img: "https://example.com/cover.jpg", song_count: 2 }],
        }),
    );

    expect(detail).toMatchObject({
      name: "新版歌单",
      coverUrl: "https://example.com/cover.jpg",
      trackCount: 2,
    });
    expect(detail.songs).toHaveLength(2);
  });
});
