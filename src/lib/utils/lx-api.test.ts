import { describe, expect, it, vi, beforeEach } from "vitest";

const mockedFetch = vi.fn();
global.fetch = mockedFetch;

let isWebProd = false;

vi.mock("@/lib/api/config", async () => {
  return {
    IS_NATIVE: false,
    get IS_WEB_PROD() {
      return isWebProd;
    },
    getProxyUrl: (url: string) =>
      `https://otter-music.pages.dev/proxy?url=${encodeURIComponent(url)}`,
  };
});

import { getLxUrl } from "./lx-api";

describe("getLxUrl", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isWebProd = false;
    mockedFetch.mockResolvedValue(
      new Response(
        JSON.stringify({ url: "https://audio.example.com/file.mp3" }),
        {
          status: 200,
        }
      )
    );
  });

  it("proxies LX API requests through /proxy in web production", async () => {
    isWebProd = true;

    const url = await getLxUrl("lx_kuwo", "550531860", 320);

    expect(url).toBe("https://audio.example.com/file.mp3");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const fetchUrl = mockedFetch.mock.calls[0][0] as string;
    expect(fetchUrl).toBe(
      "https://otter-music.pages.dev/proxy?url=https%3A%2F%2Flxmusicapi.onrender.com%2Furl%2Fkw%2F550531860%2F320k&headers=%7B%22X-Request-Key%22%3A%22share-v3%22%7D"
    );
  });

  it("proxies LX API requests through Vite proxy in web development", async () => {
    isWebProd = false;
    vi.stubEnv("DEV", true);

    const url = await getLxUrl("lx_kuwo", "550531860", 320);

    expect(url).toBe("https://audio.example.com/file.mp3");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = mockedFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(fetchUrl).toBe("/api/lx/url/kw/550531860/320k");
    expect(fetchOptions.headers).toEqual({ "X-Request-Key": "share-v3" });
  });

  it("requests LX API directly when not in web production or dev", async () => {
    isWebProd = false;
    vi.stubEnv("DEV", false);

    const url = await getLxUrl("lx_kuwo", "550531860", 320);

    expect(url).toBe("https://audio.example.com/file.mp3");
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchOptions] = mockedFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(fetchUrl).toBe(
      "https://lxmusicapi.onrender.com/url/kw/550531860/320k"
    );
    expect(fetchOptions.headers).toEqual({ "X-Request-Key": "share-v3" });
  });
});
