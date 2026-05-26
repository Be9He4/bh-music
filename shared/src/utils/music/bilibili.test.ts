import { describe, expect, it } from "vitest";
import {
  buildBilibiliPlayUrlPath,
  buildBilibiliSearchPath,
  buildBilibiliViewPath,
  convertBilibiliSearchVideoToMusicTrack,
  parseBilibiliSearchResponse,
  parseBilibiliTrackId,
  selectBilibiliAudioUrl,
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
});
