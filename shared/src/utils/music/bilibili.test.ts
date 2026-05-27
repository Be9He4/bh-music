import { describe, expect, it } from "vitest";
import {
  buildBilibiliDurlPlayUrlPath,
  buildBilibiliPlayUrlPath,
  buildBilibiliSearchPath,
  buildBilibiliViewPath,
  convertBilibiliSearchVideoToMusicTrack,
  describePlayurlResponse,
  parseBilibiliSearchResponse,
  parseBilibiliTrackId,
  selectBilibiliAudioUrl,
  selectBilibiliDurlUrl,
} from "./bilibili";

describe("bilibili music utilities", () => {
  it("builds Bilibili API paths", () => {
    expect(buildBilibiliSearchPath("周杰伦", 2, 20)).toContain(
      "/x/web-interface/search/type?"
    );
    expect(buildBilibiliSearchPath("周杰伦", 2, 20)).toContain(
      "keyword=%E5%91%A8%E6%9D%B0%E4%BC%A6"
    );
    expect(buildBilibiliViewPath("BV1xx411c7mD")).toBe(
      "/x/web-interface/view?bvid=BV1xx411c7mD"
    );
    expect(buildBilibiliPlayUrlPath("BV1xx411c7mD", 62131)).toBe(
      "/x/player/playurl?fnval=16&bvid=BV1xx411c7mD&cid=62131"
    );
  });

  it("converts search videos to MusicTrack", () => {
    const track = convertBilibiliSearchVideoToMusicTrack({
      bvid: "BV1xx411c7mD",
      title: '<em class="keyword">周杰伦</em> 歌曲精选',
      author: "UP主",
      mid: 123,
      pic: "//i0.hdslb.com/bfs/archive/cover.jpg",
    });

    expect(track).toMatchObject({
      id: "bilibili_BV1xx411c7mD",
      name: "周杰伦 歌曲精选",
      artist: ["UP主"],
      album: "",
      pic_id: "https://i0.hdslb.com/bfs/archive/cover.jpg",
      url_id: "bilibili_BV1xx411c7mD",
      lyric_id: "",
      source: "bilibili",
      artist_ids: ["123"],
    });
  });

  it("parses search responses and hasMore", () => {
    const result = parseBilibiliSearchResponse(
      {
        code: 0,
        data: {
          numResults: 30,
          result: [
            {
              type: "video",
              bvid: "BV1",
              title: "Song",
              author: "UP",
              pic: "https://example.com/cover.jpg",
            },
          ],
        },
      },
      1,
      20
    );

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
  });

  it("parses track ids and selects the highest bandwidth audio url", () => {
    expect(parseBilibiliTrackId("bilibili_BV1xx411c7mD")).toEqual({
      bvid: "BV1xx411c7mD",
    });
    expect(parseBilibiliTrackId("netease_1")).toBeNull();

    expect(
      selectBilibiliAudioUrl({
        data: {
          dash: {
            audio: [
              { baseUrl: "https://example.com/low.m4s", bandwidth: 1 },
              { base_url: "https://example.com/high.m4s", bandwidth: 2 },
            ],
          },
        },
      })
    ).toBe("https://example.com/high.m4s");
  });

  describe("selectBilibiliAudioUrl extended field matching", () => {
    it("selects backup_url when baseUrl and base_url are missing", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {
            dash: {
              audio: [
                { backup_url: "https://example.com/backup.m4s", bandwidth: 1 },
              ],
            },
          },
        })
      ).toBe("https://example.com/backup.m4s");
    });

    it("selects backupUrl (camelCase) when snake_case is missing", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {
            dash: {
              audio: [
                {
                  backupUrl: "https://example.com/backup-camel.m4s",
                  bandwidth: 1,
                },
              ],
            },
          },
        })
      ).toBe("https://example.com/backup-camel.m4s");
    });

    it("selects url field when all other fields are missing", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {
            dash: {
              audio: [
                { url: "https://example.com/plain-url.m4s", bandwidth: 1 },
              ],
            },
          },
        })
      ).toBe("https://example.com/plain-url.m4s");
    });

    it("prefers baseUrl over backup_url when both present", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {
            dash: {
              audio: [
                {
                  baseUrl: "https://example.com/primary.m4s",
                  backup_url: "https://example.com/backup.m4s",
                  bandwidth: 1,
                },
              ],
            },
          },
        })
      ).toBe("https://example.com/primary.m4s");
    });

    it("returns null when audio array is empty", () => {
      expect(
        selectBilibiliAudioUrl({
          data: { dash: { audio: [] } },
        })
      ).toBeNull();
    });

    it("returns null when no recognizable URL field exists", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {
            dash: {
              audio: [{ bandwidth: 320, codecs: "mp4a.40.2" }],
            },
          },
        })
      ).toBeNull();
    });

    it("returns null when dash is missing", () => {
      expect(
        selectBilibiliAudioUrl({
          data: {},
        } as any)
      ).toBeNull();
    });
  });

  describe("selectBilibiliDurlUrl", () => {
    it("extracts the first durl entry url", () => {
      expect(
        selectBilibiliDurlUrl({
          data: {
            durl: [
              { url: "https://example.com/segment1.flv", length: 1000 },
              { url: "https://example.com/segment2.flv", length: 1000 },
            ],
          },
        })
      ).toBe("https://example.com/segment1.flv");
    });

    it("returns null when durl array is empty", () => {
      expect(
        selectBilibiliDurlUrl({
          data: { durl: [] },
        })
      ).toBeNull();
    });

    it("returns null when data is missing", () => {
      expect(selectBilibiliDurlUrl({} as any)).toBeNull();
    });

    it("normalizes protocol-relative URLs", () => {
      expect(
        selectBilibiliDurlUrl({
          data: {
            durl: [{ url: "//example.com/audio.flv" }],
          },
        })
      ).toBe("https://example.com/audio.flv");
    });
  });

  describe("describePlayurlResponse", () => {
    it("reports missing data", () => {
      expect(describePlayurlResponse({})).toContain(
        "response.data is null/undefined"
      );
    });

    it("reports missing dash", () => {
      expect(describePlayurlResponse({ data: {} } as any)).toContain(
        "dash: missing"
      );
    });

    it("reports empty audio array", () => {
      const desc = describePlayurlResponse({
        data: { dash: { audio: [] } },
      } as any);
      expect(desc).toContain("dash.audio.length: 0");
    });

    it("reports entry field keys", () => {
      const desc = describePlayurlResponse({
        data: {
          dash: {
            audio: [{ mimeType: "audio/mp4", codecs: "mp4a" }],
          },
        },
      } as any);
      expect(desc).toContain("first entry keys:");
      expect(desc).toContain("audio/mp4");
    });
  });

  describe("buildBilibiliDurlPlayUrlPath", () => {
    it("builds durl path with fnval=0", () => {
      expect(buildBilibiliDurlPlayUrlPath("BV1xx411c7mD", 62131)).toBe(
        "/x/player/playurl?fnval=0&bvid=BV1xx411c7mD&cid=62131"
      );
    });
  });
});
