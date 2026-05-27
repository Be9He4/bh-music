import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.doUnmock("@/lib/api/config");
  vi.doUnmock("@capacitor/core");
  vi.doUnmock("@/lib/utils/blob-registry");
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
  it("downloads native audio as blob via CapacitorHttp with Bilibili headers", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: {
          code: 0,
          data: { pages: [{ cid: 62131 }] },
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          code: 0,
          data: {
            dash: {
              audio: [{ baseUrl: "https://example.com/audio.m4s" }],
            },
          },
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: "ZHVtbXk=",
        headers: { "Content-Type": "audio/mp4" },
      });
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi.fn(),
      getApiUrl: () => "https://otter-music.pages.dev",
      IS_NATIVE: true,
      IS_WEB_PROD: false,
    }));
    vi.doMock("@capacitor/core", () => ({
      CapacitorHttp: { request },
    }));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:native-audio");

    const { getBilibiliSongUrl } = await import("./bilibili-api");

    await expect(getBilibiliSongUrl("bilibili_BV1xx411c7mD")).resolves.toBe(
      "blob:native-audio"
    );
  });

  it("returns null on native when audio download fails", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        data: {
          code: 0,
          data: { pages: [{ cid: 62131 }] },
        },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          code: 0,
          data: {
            dash: {
              audio: [{ baseUrl: "https://example.com/audio.m4s" }],
            },
          },
        },
      })
      .mockResolvedValueOnce({
        status: 404,
        data: null,
      });
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi.fn(),
      getApiUrl: () => "https://otter-music.pages.dev",
      IS_NATIVE: true,
      IS_WEB_PROD: false,
    }));
    vi.doMock("@capacitor/core", () => ({
      CapacitorHttp: { request },
    }));

    const { getBilibiliSongUrl } = await import("./bilibili-api");

    await expect(getBilibiliSongUrl("bilibili_BV1xx411c7mD")).resolves.toBeNull();
  });

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

    await expect(
      getBilibiliCoverUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")
    ).resolves.toBe(
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

    await expect(
      getBilibiliCoverUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")
    ).resolves.toBe(
      "https://api.example.com/music-api/bilibili/cover?url=https%3A%2F%2Fi0.hdslb.com%2Fbfs%2Farchive%2Fcover.jpg"
    );
  });

  it("downloads native cover as blob via CapacitorHttp with Bilibili headers", async () => {
    const request = vi.fn().mockResolvedValue({
      status: 200,
      data: new Blob(),
      headers: { "Content-Type": "image/jpeg" },
    });
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi.fn(),
      getApiUrl: () => "https://otter-music.pages.dev",
      IS_NATIVE: true,
      IS_WEB_PROD: false,
    }));
    vi.doMock("@capacitor/core", () => ({
      CapacitorHttp: { request },
    }));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:native-cover");

    const { getBilibiliCoverUrl } = await import("./bilibili-api");

    await expect(
      getBilibiliCoverUrl("https://i0.hdslb.com/bfs/archive/cover.jpg")
    ).resolves.toBe("blob:native-cover");

    const callOptions = request.mock.calls[0][0];
    expect(callOptions.url).toBe("https://i0.hdslb.com/bfs/archive/cover.jpg");
    expect(callOptions.headers).toHaveProperty("Referer", "https://www.bilibili.com/");
  });

  it("converts base64 data to blob on native when cover request returns string", async () => {
    const request = vi.fn().mockResolvedValue({
      status: 200,
      data: "ZHVtbXk=",
      headers: { "Content-Type": "image/jpeg" },
    });
    vi.doMock("@/lib/api/config", () => ({
      fetchWithTimeout: vi.fn(),
      getApiUrl: () => "https://otter-music.pages.dev",
      IS_NATIVE: true,
      IS_WEB_PROD: false,
    }));
    vi.doMock("@capacitor/core", () => ({
      CapacitorHttp: { request },
    }));
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:native-cover-base64");

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
