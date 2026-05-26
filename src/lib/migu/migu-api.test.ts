import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getMiguLyric,
  parseMiguPlaylistUrl,
  resolveMiguPlaylistId,
} from "./migu-api";
import {
  buildMiguPlaylistInfoPath,
  buildMiguPlaylistSongsPath,
  buildMiguSearchPath,
  buildMiguSongUrlPath,
  convertMiguSearchSongToMusicTrack,
  convertMiguSongToMusicTrack,
  fetchMiguPlaylistDetail,
  generateMiguDeviceId,
  generateMiguSign,
  generateMiguSid,
  parseMiguPlaylistInfoResponse,
  parseMiguPlaylistSongsResponse,
  parseMiguSongUrlResponse,
  parseMiguTrackId,
} from "@otter-music/shared";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.doUnmock("@/lib/api/config");
  vi.doUnmock("@capacitor/core");
  vi.doUnmock("../music-provider");
  vi.resetModules();
});

describe("parseMiguPlaylistUrl", () => {
  it("extracts playlist id from PC links", () => {
    expect(
      parseMiguPlaylistUrl("https://music.migu.cn/v3/music/playlist/127623862")
    ).toBe("127623862");
  });

  it("extracts playlist id from mobile links", () => {
    expect(
      parseMiguPlaylistUrl(
        "https://m.music.migu.cn/v3/music/playlist/127623862"
      )
    ).toBe("127623862");
  });

  it("extracts playlist id from my playlist links", () => {
    expect(
      parseMiguPlaylistUrl("https://music.migu.cn/v3/my/playlist/127623862")
    ).toBe("127623862");
  });

  it("rejects invalid links", () => {
    expect(
      parseMiguPlaylistUrl("https://music.migu.cn/v3/music/song/1")
    ).toBeNull();
    expect(parseMiguPlaylistUrl("not a url")).toBeNull();
  });
});

describe("resolveMiguPlaylistId", () => {
  it("returns direct playlist IDs without issuing a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      resolveMiguPlaylistId("https://music.migu.cn/v3/music/playlist/127623862")
    ).resolves.toBe("127623862");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("resolves c.migu.cn short links through the Migu API route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ playlistId: "234235348" }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      resolveMiguPlaylistId("https://c.migu.cn/00CQck?ifrom=share")
    ).resolves.toBe("234235348");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/migu-resolve");
  });

  it("returns null when short-link resolution fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 400 }))
    );

    await expect(
      resolveMiguPlaylistId("https://c.migu.cn/00CQck")
    ).resolves.toBeNull();
  });
});

describe("build migu paths", () => {
  it("builds V2 search path with sid", () => {
    const sid =
      "abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234";
    const path = buildMiguSearchPath("周杰伦", 1, 20, sid);
    expect(path).toContain("/music_search/v2/search/searchAll?");
    expect(path).toContain("sid=" + sid);
    expect(path).toContain("feature=1000000000");
    expect(path).toContain("sort=1");
  });

  it("builds playlist info endpoint", () => {
    const path = buildMiguPlaylistInfoPath("127623862");
    expect(path).toContain("/MIGUM2.0/v1.0/content/resourceinfo.do?");
    expect(path).toContain("resourceType=2021");
    expect(path).toContain("resourceId=127623862");
  });

  it("builds playlist songs endpoint", () => {
    const path = buildMiguPlaylistSongsPath("127623862", 2, 50);
    expect(path).toContain("/MIGUM2.0/v1.0/user/queryMusicListSongs.do?");
    expect(path).toContain("musicListId=127623862");
    expect(path).toContain("pageNo=2");
    expect(path).toContain("pageSize=50");
  });

  it("builds song url endpoint with quality", () => {
    expect(buildMiguSongUrlPath("c1", "p1", 192)).toContain("toneFlag=PQ");
    expect(buildMiguSongUrlPath("c1", "p1", 320)).toContain("toneFlag=HQ");
    expect(buildMiguSongUrlPath("c1", "p1", 999)).toContain("toneFlag=SQ");
  });
});

describe("migu sign utils", () => {
  it("generateMiguSid returns 32-char hex", () => {
    const sid = generateMiguSid();
    expect(sid).toHaveLength(32);
    expect(/^[0-9a-f]{32}$/.test(sid)).toBe(true);
  });

  it("generateMiguDeviceId returns uppercase MD5 hex", () => {
    const id = generateMiguDeviceId();
    expect(id).toHaveLength(32);
    expect(/^[0-9A-F]{32}$/.test(id)).toBe(true);
  });

  it("generateMiguSign returns lowercase MD5 hex", () => {
    const sign = generateMiguSign(
      "周杰伦",
      "ABCDEF1234567890ABCDEF1234567890",
      1779764302446
    );
    expect(sign).toHaveLength(32);
    expect(/^[0-9a-f]{32}$/.test(sign)).toBe(true);
  });

  it("generateMiguSign is deterministic", () => {
    const a = generateMiguSign("test", "DEVICEID12345678901234567890", 1000);
    const b = generateMiguSign("test", "DEVICEID12345678901234567890", 1000);
    expect(a).toBe(b);
  });
});

describe("parse migu responses", () => {
  it("parses playlist info JSON", () => {
    const res = parseMiguPlaylistInfoResponse(
      '{"code":"000000","resource":[{"title":"歌单"}]}'
    );
    expect(res.resource?.[0].title).toBe("歌单");
  });

  it("parses playlist songs JSON", () => {
    const res = parseMiguPlaylistSongsResponse(
      '{"code":"000000","totalCount":1,"list":[{"songName":"歌曲"}]}'
    );
    expect(res.totalCount).toBe(1);
    expect(res.list?.[0].songName).toBe("歌曲");
  });

  it("parses song url JSON", () => {
    const url = parseMiguSongUrlResponse({
      data: { url: "//example.com/a+b.mp3" },
    });
    expect(url).toBe("https://example.com/a%2Bb.mp3");
  });
});

describe("getMiguLyric", () => {
  it("loads web lyrics through the generic proxy", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("[00:00.00]歌词", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getMiguLyric("https://d.musicapp.migu.cn/lrc")
    ).resolves.toEqual({
      lyric: "[00:00.00]歌词",
      tlyric: "",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/proxy?url=https%3A%2F%2Fd.musicapp.migu.cn%2Flrc"
    );
  });

  it("loads native lyrics directly through CapacitorHttp", async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ status: 200, data: "[00:00.00]歌词" });
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi.fn(),
      getApiUrl: vi.fn(),
      getProxyUrl: vi.fn(),
      IS_NATIVE: true,
      IS_WEB_PROD: false,
    }));
    vi.doMock("../music-provider", () => ({
      forceHttps: (url: string) => url.replace(/^http:\/\//i, "https://"),
    }));
    vi.doMock("@capacitor/core", () => ({ CapacitorHttp: { request } }));

    const { getMiguLyric: getNativeMiguLyric } = await import("./migu-api");
    await expect(
      getNativeMiguLyric("http://d.musicapp.migu.cn/lrc")
    ).resolves.toEqual({
      lyric: "[00:00.00]歌词",
      tlyric: "",
    });
    expect(request).toHaveBeenCalledWith({
      method: "GET",
      url: "https://d.musicapp.migu.cn/lrc",
    });
  });

  it("returns null for invalid lyric URLs", async () => {
    await expect(getMiguLyric("")).resolves.toBeNull();
  });
});

describe("convertMiguSongToMusicTrack", () => {
  it("converts Migu songs to MusicTrack", () => {
    const track = convertMiguSongToMusicTrack({
      copyrightId: "60054704083",
      contentId: "600908000006663347",
      songName: "等你下课(with 杨瑞代)",
      artists: [{ id: "112", name: "周杰伦" }],
      album: "最伟大的作品",
      albumId: "1139846638",
      albumImgs: [{ img: "https://d.musicapp.migu.cn/cover.webp" }],
      lrcUrl: "https://d.musicapp.migu.cn/lyric",
    });

    expect(track).toMatchObject({
      id: "migu_60054704083_600908000006663347",
      name: "等你下课(with 杨瑞代)",
      artist: ["周杰伦"],
      album: "最伟大的作品",
      pic_id: "https://d.musicapp.migu.cn/cover.webp",
      url_id: "migu_60054704083_600908000006663347",
      lyric_id: "https://d.musicapp.migu.cn/lyric",
      source: "migu",
      artist_ids: ["112"],
      album_id: "1139846638",
    });
  });

  it("splits singer fallback", () => {
    const track = convertMiguSongToMusicTrack({
      copyrightId: "1",
      contentId: "2",
      songName: "Song",
      singer: "A|B",
    });

    expect(track.artist).toEqual(["A", "B"]);
  });
});

describe("convertMiguSearchSongToMusicTrack", () => {
  it("converts V2 search results to MusicTrack", () => {
    const track = convertMiguSearchSongToMusicTrack({
      copyrightId: "6902739Z0BT",
      contentId: "600919000007823377",
      name: "太阳之子",
      singers: [{ id: "112", name: "周杰伦" }],
      albums: [{ id: "1142521343", name: "太阳之子" }],
      lyricUrl: "https://d.musicapp.migu.cn/data/oss/resource/lyric",
      imgItems: [
        { imgSizeType: "1", img: "https://d.musicapp.migu.cn/cover.webp" },
      ],
    });

    expect(track).toMatchObject({
      id: "migu_6902739Z0BT_600919000007823377",
      name: "太阳之子",
      artist: ["周杰伦"],
      album: "太阳之子",
      pic_id: "https://d.musicapp.migu.cn/cover.webp",
      url_id: "migu_6902739Z0BT_600919000007823377",
      lyric_id: "https://d.musicapp.migu.cn/data/oss/resource/lyric",
      source: "migu",
      artist_ids: ["112"],
      album_id: "1142521343",
    });
  });

  it("handles missing fields gracefully", () => {
    const track = convertMiguSearchSongToMusicTrack({});
    expect(track).toMatchObject({
      name: "未知歌曲",
      artist: [],
      album: "",
      source: "migu",
    });
  });
});

describe("fetchMiguPlaylistDetail", () => {
  it("fetches playlist info and songs", async () => {
    const detail = await fetchMiguPlaylistDetail(
      "127623862",
      async (path: string) => {
        if (path.includes("resourceinfo.do")) {
          return JSON.stringify({
            code: "000000",
            resource: [
              {
                title: "咪咕歌单",
                musicNum: 1,
                imgItem: { img: "https://example.com/cover.webp" },
              },
            ],
          });
        }
        return JSON.stringify({
          code: "000000",
          totalCount: 1,
          list: [{ copyrightId: "1", contentId: "2", songName: "Song" }],
        });
      }
    );

    expect(detail.name).toBe("咪咕歌单");
    expect(detail.coverUrl).toBe("https://example.com/cover.webp");
    expect(detail.trackCount).toBe(1);
    expect(detail.songs).toHaveLength(1);
  });

  it("throws for empty playlists", async () => {
    await expect(
      fetchMiguPlaylistDetail("1", async (path: string) => {
        if (path.includes("resourceinfo.do")) {
          return JSON.stringify({
            code: "000000",
            resource: [{ musicNum: 0 }],
          });
        }
        return JSON.stringify({ code: "000000", list: [] });
      })
    ).rejects.toThrow("歌单为空");
  });
});

describe("parseMiguTrackId", () => {
  it("parses internal migu track ids", () => {
    expect(parseMiguTrackId("migu_60054704083_600908000006663347")).toEqual({
      copyrightId: "60054704083",
      contentId: "600908000006663347",
    });
  });
});

// ============================================================
// searchMiguSongs — jadeite.migu.cn V2 搜索集成测试
// ============================================================

function makeV2SearchResponse(songs: Array<Record<string, unknown>>) {
  return {
    code: "000000",
    songResultData: {
      totalCount: String(songs.length),
      result: songs,
    },
  };
}

const sampleSearchSong = {
  copyrightId: "6902739Z0BT",
  contentId: "600919000007823377",
  name: "太阳之子",
  singers: [{ id: "112", name: "周杰伦" }],
  albums: [{ id: "1142521343", name: "太阳之子" }],
  lyricUrl: "https://d.musicapp.migu.cn/lyric",
  imgItems: [{ img: "https://d.musicapp.migu.cn/cover.webp" }],
};

describe("searchMiguSongs (dev)", () => {
  it("sends sign headers to jadeite.migu.cn", async () => {
    const fetchWithTimeout = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(makeV2SearchResponse([sampleSearchSong])), {
        status: 200,
      })
    );
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout,
      getApiUrl: vi.fn(),
      getProxyUrl: vi.fn(),
      IS_NATIVE: false,
      IS_WEB_PROD: false,
    }));

    const { searchMiguSongs } = await import("./migu-api");
    const result = await searchMiguSongs("周杰伦", 1);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "migu_6902739Z0BT_600919000007823377",
      name: "太阳之子",
      artist: ["周杰伦"],
      source: "migu",
    });
    expect(result.hasMore).toBe(false);
    const url = String(fetchWithTimeout.mock.calls[0][0]);
    expect(url).toContain("/api/migu-v2/music_search/v2/search/searchAll");
    const opts = fetchWithTimeout.mock.calls[0][1];
    expect(opts.headers).toHaveProperty("appid", "yyapp2");
    expect(opts.headers).toHaveProperty("deviceid");
    expect(opts.headers).toHaveProperty("sign");
    expect(opts.headers).toHaveProperty("timestamp");
    expect(opts.headers).toHaveProperty("uiversion", "A_music_3.3.0");
    expect(opts.headers).toHaveProperty("version", "7.0.4");
  });

  it("returns empty on non-ok response", async () => {
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi
        .fn()
        .mockResolvedValue(new Response("{}", { status: 500 })),
      getApiUrl: vi.fn(),
      getProxyUrl: vi.fn(),
      IS_NATIVE: false,
      IS_WEB_PROD: false,
    }));

    const { searchMiguSongs } = await import("./migu-api");
    const result = await searchMiguSongs("test", 1);

    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it("returns empty on network error", async () => {
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi.fn().mockRejectedValue(new Error("network error")),
      getApiUrl: vi.fn(),
      getProxyUrl: vi.fn(),
      IS_NATIVE: false,
      IS_WEB_PROD: false,
    }));

    const { searchMiguSongs } = await import("./migu-api");
    const result = await searchMiguSongs("test", 1);

    expect(result.items).toHaveLength(0);
  });

  it("returns empty when songResultData.result is empty", async () => {
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ code: "000000", songResultData: { result: [] } }),
            { status: 200 }
          )
        ),
      getApiUrl: vi.fn(),
      getProxyUrl: vi.fn(),
      IS_NATIVE: false,
      IS_WEB_PROD: false,
    }));

    const { searchMiguSongs } = await import("./migu-api");
    const result = await searchMiguSongs("test", 1);

    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });
});

describe("searchMiguSongs (native)", () => {
  it("uses CapacitorHttp with sign headers to jadeite.migu.cn", async () => {
    const request = vi.fn().mockResolvedValue({
      status: 200,
      data: makeV2SearchResponse([sampleSearchSong]),
    });
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi.fn(),
      getApiUrl: vi.fn(),
      getProxyUrl: vi.fn(),
      IS_NATIVE: true,
      IS_WEB_PROD: false,
    }));
    vi.doMock("@capacitor/core", () => ({ CapacitorHttp: { request } }));

    const { searchMiguSongs } = await import("./migu-api");
    const result = await searchMiguSongs("周杰伦", 1);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe("太阳之子");
    const call = request.mock.calls[0][0];
    expect(call.url).toContain(
      "https://jadeite.migu.cn/music_search/v2/search/searchAll"
    );
    expect(call.headers).toHaveProperty("appid", "yyapp2");
    expect(call.headers).toHaveProperty("sign");
  });

  it("returns empty on native HTTP error", async () => {
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi.fn(),
      getApiUrl: vi.fn(),
      getProxyUrl: vi.fn(),
      IS_NATIVE: true,
      IS_WEB_PROD: false,
    }));
    vi.doMock("@capacitor/core", () => ({
      CapacitorHttp: {
        request: vi.fn().mockResolvedValue({ status: 500, data: "{}" }),
      },
    }));

    const { searchMiguSongs } = await import("./migu-api");
    const result = await searchMiguSongs("test", 1);

    expect(result.items).toHaveLength(0);
  });
});

describe("searchMiguSongs (web prod)", () => {
  it("POSTs to the backend worker", async () => {
    const fetchWithTimeout = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [], hasMore: false }), {
          status: 200,
        })
      );
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout,
      getApiUrl: () => "https://api.example.com",
      getProxyUrl: vi.fn(),
      IS_NATIVE: false,
      IS_WEB_PROD: true,
    }));

    const { searchMiguSongs } = await import("./migu-api");
    const result = await searchMiguSongs("周杰伦", 1, 30);

    expect(result.items).toHaveLength(0);
    const [url, init] = fetchWithTimeout.mock.calls[0];
    expect(url).toBe("https://api.example.com/music-api/migu/search");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      keyword: "周杰伦",
      page: 1,
      rows: 30,
    });
  });
});
