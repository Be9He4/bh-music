import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.doUnmock("@/lib/api/config");
  vi.doUnmock("@capacitor/core");
  vi.resetModules();
});

function makeSearchResponse() {
  return {
    code: 0,
    data: {
      numResults: 1,
      result: [
        {
          type: "video",
          bvid: "BV1xx411c7mD",
          title: "Song",
          author: "UP",
          pic: "https://example.com/cover.jpg",
        },
      ],
    },
  };
}

describe("searchBilibiliVideos", () => {
  it("loads dev search results through the Vite Bilibili proxy", async () => {
    const fetchWithTimeout = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(makeSearchResponse()), {
        status: 200,
      })
    );
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout,
      getApiUrl: () => "https://otter-music.pages.dev",
      IS_NATIVE: false,
      IS_WEB_PROD: false,
    }));

    const { searchBilibiliVideos } = await import("./bilibili-api");
    const result = await searchBilibiliVideos("周杰伦", 1, 20);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "bilibili_BV1xx411c7mD",
      source: "bilibili",
    });
    expect(String(fetchWithTimeout.mock.calls[0][0])).toContain(
      "/api/bilibili/x/web-interface/search/type"
    );
  });

  it("posts prod search requests to the worker route", async () => {
    const fetchWithTimeout = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [], hasMore: false }), {
        status: 200,
      })
    );
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout,
      getApiUrl: () => "https://api.example.com",
      IS_NATIVE: false,
      IS_WEB_PROD: true,
    }));

    const { searchBilibiliVideos } = await import("./bilibili-api");
    await searchBilibiliVideos("周杰伦", 2, 30);

    const [url, init] = fetchWithTimeout.mock.calls[0];
    expect(url).toBe("https://api.example.com/music-api/bilibili/search");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      keyword: "周杰伦",
      page: 2,
      rows: 30,
    });
  });
});

describe("getBilibiliSongUrl", () => {
  it("resolves dev song urls through view and playurl", async () => {
    const fetchWithTimeout = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: { pages: [{ cid: 62131 }] },
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 0,
            data: {
              dash: {
                audio: [{ baseUrl: "https://example.com/audio.m4s" }],
              },
            },
          }),
          { status: 200 }
        )
      );
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout,
      getApiUrl: () => "https://otter-music.pages.dev",
      IS_NATIVE: false,
      IS_WEB_PROD: false,
    }));

    const { getBilibiliSongUrl } = await import("./bilibili-api");

    await expect(getBilibiliSongUrl("bilibili_BV1xx411c7mD")).resolves.toBe(
      "/api/bilibili-audio?bvid=BV1xx411c7mD&url=https%3A%2F%2Fexample.com%2Faudio.m4s"
    );
  });

  it("returns null for invalid Bilibili track ids", async () => {
    const { getBilibiliSongUrl } = await import("./bilibili-api");

    await expect(getBilibiliSongUrl("netease_1")).resolves.toBeNull();
  });
});

describe("getBilibiliCoverUrl", () => {
  it("wraps dev cover urls through the Vite Bilibili cover proxy", async () => {
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi.fn(),
      getApiUrl: () => "https://otter-music.pages.dev",
      IS_NATIVE: false,
      IS_WEB_PROD: false,
    }));

    const { getBilibiliCoverUrl } = await import("./bilibili-api");

    expect(
      getBilibiliCoverUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")
    ).toBe(
      "/api/bilibili-cover?url=https%3A%2F%2Fi0.hdslb.com%2Fbfs%2Farchive%2Fcover.jpg"
    );
  });

  it("wraps prod cover urls through the worker Bilibili cover proxy", async () => {
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi.fn(),
      getApiUrl: () => "https://api.example.com",
      IS_NATIVE: false,
      IS_WEB_PROD: true,
    }));

    const { getBilibiliCoverUrl } = await import("./bilibili-api");

    expect(
      getBilibiliCoverUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")
    ).toBe(
      "https://api.example.com/music-api/bilibili/cover?url=https%3A%2F%2Fi0.hdslb.com%2Fbfs%2Farchive%2Fcover.jpg"
    );
  });

  it("returns null for empty cover urls", async () => {
    const { getBilibiliCoverUrl } = await import("./bilibili-api");

    expect(getBilibiliCoverUrl("")).toBeNull();
  });
});
