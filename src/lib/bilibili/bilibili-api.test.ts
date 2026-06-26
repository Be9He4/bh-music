import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockConfig: any;
let mockCapacitor: any;
let mockBilibiliProxy: any;

beforeEach(() => {
  mockConfig = {
    fetchWithTimeout: vi.fn(),
    getApiUrl: vi.fn().mockReturnValue("https://otter-music.pages.dev"),
    IS_NATIVE: false,
    IS_WEB_PROD: false,
  };
  mockCapacitor = {
    Capacitor: { isNativePlatform: vi.fn() },
    CapacitorHttp: { request: vi.fn() },
  };
  mockBilibiliProxy = {
    getProxyUrl: vi.fn(),
    isRunning: vi.fn(),
    startServer: vi.fn(),
  };
  vi.doMock("@/lib/api/config", () => mockConfig);
  vi.doMock("@capacitor/core", () => mockCapacitor);
  vi.doMock("@/plugins/bilibili-proxy", () => ({
    BilibiliProxy: mockBilibiliProxy,
  }));
});

afterEach(() => {
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
    mockConfig.IS_WEB_PROD = false;
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockResolvedValue(
      new Response(JSON.stringify(makeSearchResponse()), {
        status: 200,
      })
    );

    const { searchBilibiliVideos } = await import("./bilibili-api");
    const result = await searchBilibiliVideos("周杰伦", 1, 20);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "bilibili_BV1xx411c7mD",
      source: "bilibili",
    });
    expect(String(mockConfig.fetchWithTimeout.mock.calls[0][0])).toContain(
      "/api/bilibili/x/web-interface/search/type"
    );
  });

  it("returns empty collections in dev search results", async () => {
    mockConfig.IS_WEB_PROD = false;
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            numResults: 2,
            result: [
              { type: "video", bvid: "BV1xx", title: "Song", author: "UP" },
              {
                type: "video",
                bvid: "BV1yy",
                title: "合集曲目1",
                author: "音乐UP",
              },
            ],
          },
        }),
        { status: 200 }
      )
    );

    const { searchBilibiliVideos } = await import("./bilibili-api");
    const result = await searchBilibiliVideos("周杰伦", 1, 20);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ id: "bilibili_BV1xx" });
    expect(result.items[1]).toMatchObject({ id: "bilibili_BV1yy" });
  });

  it("posts prod search requests to the worker route", async () => {
    mockConfig.IS_WEB_PROD = true;
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://api.example.com");
    mockConfig.fetchWithTimeout.mockResolvedValue(
      new Response(JSON.stringify({ items: [], hasMore: false }), {
        status: 200,
      })
    );

    const { searchBilibiliVideos } = await import("./bilibili-api");
    await searchBilibiliVideos("周杰伦", 2, 30);

    const [url, init] = mockConfig.fetchWithTimeout.mock.calls[0];
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
  it("returns proxy url via BilibiliProxy on native platform", async () => {
    mockBilibiliProxy.getProxyUrl.mockResolvedValue({
      success: true,
      url: "http://localhost:8080/stream",
    });
    mockBilibiliProxy.isRunning.mockResolvedValue({ running: false });
    mockBilibiliProxy.startServer.mockResolvedValue({
      success: true,
      port: 8080,
    });
    mockCapacitor.CapacitorHttp.request
      .mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          code: 0,
          data: { pages: [{ cid: 62131 }] },
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          code: 0,
          data: {
            dash: {
              audio: [{ baseUrl: "https://example.com/audio.m4s" }],
            },
          },
        }),
      });
    mockConfig.IS_NATIVE = true;
    mockConfig.IS_WEB_PROD = false;
    mockCapacitor.Capacitor.isNativePlatform.mockReturnValue(true);
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockReset();

    const { getBilibiliSongUrl } = await import("./bilibili-api");

    await expect(getBilibiliSongUrl("bilibili_BV1xx411c7mD")).resolves.toEqual({
      url: "http://localhost:8080/stream",
      format: "m4a",
    });
  });

  it("returns null on native when proxy fails to get stream url", async () => {
    mockBilibiliProxy.getProxyUrl.mockResolvedValue({
      success: false,
      url: "",
    });
    mockBilibiliProxy.isRunning.mockResolvedValue({ running: false });
    mockBilibiliProxy.startServer.mockResolvedValue({
      success: true,
      port: 8080,
    });
    mockCapacitor.CapacitorHttp.request
      .mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          code: 0,
          data: { pages: [{ cid: 62131 }] },
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        data: JSON.stringify({
          code: 0,
          data: {
            dash: {
              audio: [{ baseUrl: "https://example.com/audio.m4s" }],
            },
          },
        }),
      });
    mockConfig.IS_NATIVE = true;
    mockConfig.IS_WEB_PROD = false;
    mockCapacitor.Capacitor.isNativePlatform.mockReturnValue(true);
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockReset();

    const { getBilibiliSongUrl } = await import("./bilibili-api");

    await expect(
      getBilibiliSongUrl("bilibili_BV1xx411c7mD")
    ).resolves.toBeNull();
  });

  it("resolves dev song urls through view and playurl", async () => {
    mockConfig.IS_WEB_PROD = false;
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout
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
                audio: [
                  {
                    baseUrl: "https://example.com/audio.m4s",
                    mimeType: "audio/mp4",
                  },
                ],
              },
            },
          }),
          { status: 200 }
        )
      );

    const { getBilibiliSongUrl } = await import("./bilibili-api");

    await expect(getBilibiliSongUrl("bilibili_BV1xx411c7mD")).resolves.toEqual({
      url: "/api/bilibili-audio?bvid=BV1xx411c7mD&url=https%3A%2F%2Fexample.com%2Faudio.m4s",
      format: "m4s",
    });
  });

  it("returns null for invalid Bilibili track ids", async () => {
    const { getBilibiliSongUrl } = await import("./bilibili-api");

    await expect(getBilibiliSongUrl("netease_1")).resolves.toBeNull();
  });
});

describe("getBilibiliCoverUrl", () => {
  it("wraps dev cover urls through the Vite Bilibili cover proxy", async () => {
    mockConfig.IS_NATIVE = false;
    mockConfig.IS_WEB_PROD = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockReset();

    const { getBilibiliCoverUrl } = await import("./bilibili-api");

    await expect(
      getBilibiliCoverUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")
    ).resolves.toBe(
      "/api/bilibili-cover?url=https%3A%2F%2Fi0.hdslb.com%2Fbfs%2Farchive%2Fcover.jpg"
    );
  });

  it("wraps prod cover urls through the worker Bilibili cover proxy", async () => {
    mockConfig.IS_NATIVE = false;
    mockConfig.IS_WEB_PROD = true;
    mockConfig.getApiUrl.mockReturnValue("https://api.example.com");
    mockConfig.fetchWithTimeout.mockReset();

    const { getBilibiliCoverUrl } = await import("./bilibili-api");

    await expect(
      getBilibiliCoverUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")
    ).resolves.toBe(
      "https://api.example.com/music-api/bilibili/cover?url=https%3A%2F%2Fi0.hdslb.com%2Fbfs%2Farchive%2Fcover.jpg"
    );
  });

  it("downloads native cover as blob via CapacitorHttp with Bilibili headers", async () => {
    mockCapacitor.CapacitorHttp.request.mockResolvedValue({
      status: 200,
      data: new Blob(),
      headers: { "Content-Type": "image/jpeg" },
    });
    mockConfig.IS_NATIVE = true;
    mockConfig.IS_WEB_PROD = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockReset();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:native-cover");

    const { getBilibiliCoverUrl } = await import("./bilibili-api");

    await expect(
      getBilibiliCoverUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")
    ).resolves.toBe("blob:native-cover");

    const callOptions = mockCapacitor.CapacitorHttp.request.mock.calls[0][0];
    expect(callOptions.url).toBe("https://i0.hdslb.com/bfs/archive/cover.jpg");
    expect(callOptions.headers).toHaveProperty(
      "Referer",
      "https://www.bilibili.com/"
    );
  });

  it("converts base64 data to blob on native when cover request returns string", async () => {
    mockCapacitor.CapacitorHttp.request.mockResolvedValue({
      status: 200,
      data: "ZHVtbXk=",
      headers: { "Content-Type": "image/jpeg" },
    });
    mockConfig.IS_NATIVE = true;
    mockConfig.IS_WEB_PROD = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockReset();
    vi.spyOn(URL, "createObjectURL").mockReturnValue(
      "blob:native-cover-base64"
    );

    const { getBilibiliCoverUrl } = await import("./bilibili-api");

    await expect(
      getBilibiliCoverUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")
    ).resolves.toBe("blob:native-cover-base64");
  });

  it("returns null for empty cover urls", async () => {
    const { getBilibiliCoverUrl } = await import("./bilibili-api");

    await expect(getBilibiliCoverUrl("")).resolves.toBeNull();
  });
});

describe("searchBilibiliCollections", () => {
  it("returns empty collections in dev search results", async () => {
    mockConfig.IS_WEB_PROD = false;
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 0,
          data: {
            numResults: 2,
            result: [
              { type: "video", bvid: "BV1aa", title: "Song 1", author: "UP1" },
              { type: "video", bvid: "BV1bb", title: "Song 2", author: "UP2" },
            ],
          },
        }),
        { status: 200 }
      )
    );

    const { searchBilibiliCollections } = await import("./bilibili-api");
    const result = await searchBilibiliCollections("合集", 1, 20);

    expect(result.items).toHaveLength(0);
    expect(result.hasMore).toBe(false);
  });

  it("sends prod collection search to worker route", async () => {
    mockConfig.IS_WEB_PROD = true;
    mockConfig.IS_NATIVE = false;
    mockConfig.getApiUrl.mockReturnValue("https://api.example.com");
    mockConfig.fetchWithTimeout.mockResolvedValue(
      new Response(JSON.stringify({ items: [], hasMore: false }), {
        status: 200,
      })
    );

    const { searchBilibiliCollections } = await import("./bilibili-api");
    await searchBilibiliCollections("合集", 1, 20);

    const [url, init] = mockConfig.fetchWithTimeout.mock.calls[0];
    expect(url).toBe(
      "https://api.example.com/music-api/bilibili/search-collections"
    );
    expect(init.method).toBe("POST");
  });
});

describe("getBilibiliCollectionDetail", () => {
  it("returns null for non-series album id", async () => {
    mockConfig.IS_NATIVE = false;
    mockConfig.IS_WEB_PROD = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockReset();

    const { getBilibiliCollectionDetail } = await import("./bilibili-api");
    await expect(
      getBilibiliCollectionDetail("bilibili_BV1xx")
    ).resolves.toBeNull();
  });

  it("returns null for non-bilibili album id", async () => {
    mockConfig.IS_NATIVE = false;
    mockConfig.IS_WEB_PROD = false;
    mockConfig.getApiUrl.mockReturnValue("https://otter-music.pages.dev");
    mockConfig.fetchWithTimeout.mockReset();

    const { getBilibiliCollectionDetail } = await import("./bilibili-api");
    await expect(
      getBilibiliCollectionDetail("netease_123")
    ).resolves.toBeNull();
  });
});
