import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useUrlCacheStore,
  buildUrlCacheKey,
  purgeDeadBlobEntries,
} from "./url-cache-store";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@/lib/utils/blob-registry", () => ({
  revokeBlobUrl: vi.fn(),
}));

const { revokeBlobUrl } = await import("@/lib/utils/blob-registry");

describe("buildUrlCacheKey", () => {
  it("should use trackId for netease-like sources", () => {
    expect(buildUrlCacheKey("netease", "123", "123", "128")).toBe(
      "netease:123:128"
    );
  });

  it("should use urlId for local source", () => {
    expect(
      buildUrlCacheKey("local", "local-456", "/music/song.mp3", "320")
    ).toBe("local:/music/song.mp3:320");
  });

  it("should use urlId for podcast source", () => {
    expect(
      buildUrlCacheKey("podcast", "pod-789", "https://feed.test/ep1.mp3", "192")
    ).toBe("podcast:https://feed.test/ep1.mp3:192");
  });

  it("should fallback to trackId when local urlId is missing", () => {
    expect(buildUrlCacheKey("local", "local-456", undefined, "128")).toBe(
      "local:local-456:128"
    );
  });
});

describe("UrlCacheStore", () => {
  beforeEach(() => {
    useUrlCacheStore.setState({ urlMap: {} });
    vi.clearAllMocks();
  });

  describe("get", () => {
    it("should return undefined for missing key", () => {
      expect(useUrlCacheStore.getState().get("missing")).toBeUndefined();
    });

    it("should return cached URL", () => {
      const key = buildUrlCacheKey("netease", "123", "123", "128");
      useUrlCacheStore.getState().set(key, "https://example.com/a.mp3");
      expect(useUrlCacheStore.getState().get(key)).toBe(
        "https://example.com/a.mp3"
      );
    });
  });

  describe("set", () => {
    it("should store URL mapping", () => {
      const key = buildUrlCacheKey("netease", "123", "123", "128");
      useUrlCacheStore.getState().set(key, "https://example.com/a.mp3");
      expect(useUrlCacheStore.getState().urlMap).toEqual({
        [key]: {
          url: "https://example.com/a.mp3",
          cachedAt: expect.any(Number),
        },
      });
    });

    it("should keep different qualities in separate keys", () => {
      const key128 = buildUrlCacheKey("netease", "123", "123", "128");
      const key320 = buildUrlCacheKey("netease", "123", "123", "320");
      useUrlCacheStore.getState().set(key128, "https://example.com/128.mp3");
      useUrlCacheStore.getState().set(key320, "https://example.com/320.mp3");

      expect(useUrlCacheStore.getState().get(key128)).toBe(
        "https://example.com/128.mp3"
      );
      expect(useUrlCacheStore.getState().get(key320)).toBe(
        "https://example.com/320.mp3"
      );
    });

    it("should revoke old blob URL when overwritten", () => {
      const key = buildUrlCacheKey("netease", "123", "123", "128");
      const blobUrl = "blob:https://example.com/old";
      useUrlCacheStore.getState().set(key, blobUrl);
      useUrlCacheStore.getState().set(key, "https://example.com/new.mp3");

      expect(revokeBlobUrl).toHaveBeenCalledWith(blobUrl);
      expect(useUrlCacheStore.getState().get(key)).toBe(
        "https://example.com/new.mp3"
      );
    });

    it("should not revoke old non-blob URL when overwritten", () => {
      const key = buildUrlCacheKey("netease", "123", "123", "128");
      useUrlCacheStore.getState().set(key, "https://example.com/old.mp3");
      useUrlCacheStore.getState().set(key, "https://example.com/new.mp3");

      expect(revokeBlobUrl).not.toHaveBeenCalled();
    });

    it("should not revoke when setting same blob URL", () => {
      const key = buildUrlCacheKey("netease", "123", "123", "128");
      const blobUrl = "blob:https://example.com/same";
      useUrlCacheStore.getState().set(key, blobUrl);
      useUrlCacheStore.getState().set(key, blobUrl);

      expect(revokeBlobUrl).not.toHaveBeenCalled();
    });
  });

  describe("TTL", () => {
    const key = buildUrlCacheKey("netease", "123", "123", "128");

    it("should return url within TTL", () => {
      useUrlCacheStore.setState({
        urlMap: {
          [key]: {
            url: "https://example.com/a.mp3",
            cachedAt: Date.now() - 10 * 60 * 1000,
          },
        },
      });
      expect(useUrlCacheStore.getState().get(key)).toBe(
        "https://example.com/a.mp3"
      );
    });

    it("should treat expired entry as miss and remove it", () => {
      useUrlCacheStore.setState({
        urlMap: {
          [key]: {
            url: "https://example.com/expired.mp3",
            cachedAt: Date.now() - 16 * 60 * 1000,
          },
        },
      });
      expect(useUrlCacheStore.getState().get(key)).toBeUndefined();
      expect(useUrlCacheStore.getState().urlMap[key]).toBeUndefined();
    });

    it("should treat legacy plain-string entry as expired", () => {
      useUrlCacheStore.setState({
        urlMap: { [key]: "https://example.com/legacy.mp3" } as never,
      });
      expect(useUrlCacheStore.getState().get(key)).toBeUndefined();
      expect(useUrlCacheStore.getState().urlMap[key]).toBeUndefined();
    });

    it("should never expire blob URLs", () => {
      const blobKey = buildUrlCacheKey("netease", "456", "456", "128");
      useUrlCacheStore.setState({
        urlMap: {
          [blobKey]: {
            url: "blob:https://example.com/audio",
            cachedAt: Date.now() - 24 * 60 * 60 * 1000,
          },
        },
      });
      expect(useUrlCacheStore.getState().get(blobKey)).toBe(
        "blob:https://example.com/audio"
      );
    });
  });

  describe("purgeDeadBlobEntries", () => {
    it("should remove blob entries on rehydrate (dead across sessions)", () => {
      const blobKey = buildUrlCacheKey("netease", "456", "456", "128");
      const liveKey = buildUrlCacheKey("netease", "789", "789", "128");
      useUrlCacheStore.setState({
        urlMap: {
          [blobKey]: {
            url: "blob:https://example.com/audio",
            cachedAt: Date.now(),
          },
          [liveKey]: {
            url: "https://example.com/live.mp3",
            cachedAt: Date.now(),
          },
        },
      });

      purgeDeadBlobEntries();

      expect(useUrlCacheStore.getState().urlMap[blobKey]).toBeUndefined();
      expect(useUrlCacheStore.getState().get(liveKey)).toBe(
        "https://example.com/live.mp3"
      );
    });
  });

  describe("delete", () => {
    it("should remove URL mapping", () => {
      const key = buildUrlCacheKey("netease", "123", "123", "128");
      useUrlCacheStore.getState().set(key, "https://example.com/a.mp3");
      useUrlCacheStore.getState().delete(key);

      expect(useUrlCacheStore.getState().get(key)).toBeUndefined();
    });

    it("should revoke blob URL when deleted", () => {
      const key = buildUrlCacheKey("netease", "123", "123", "128");
      const blobUrl = "blob:https://example.com/a";
      useUrlCacheStore.getState().set(key, blobUrl);
      useUrlCacheStore.getState().delete(key);

      expect(revokeBlobUrl).toHaveBeenCalledWith(blobUrl);
    });

    it("should not revoke non-blob URL when deleted", () => {
      const key = buildUrlCacheKey("netease", "123", "123", "128");
      useUrlCacheStore.getState().set(key, "https://example.com/a.mp3");
      useUrlCacheStore.getState().delete(key);

      expect(revokeBlobUrl).not.toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("should remove all URL mappings", () => {
      useUrlCacheStore.getState().set("track-1", "https://example.com/1.mp3");
      useUrlCacheStore.getState().set("track-2", "https://example.com/2.mp3");

      useUrlCacheStore.getState().clear();

      expect(useUrlCacheStore.getState().urlMap).toEqual({});
    });

    it("should revoke all blob URLs", () => {
      const blobUrl = "blob:https://example.com/audio";
      useUrlCacheStore.getState().set("track-1", blobUrl);

      useUrlCacheStore.getState().clear();

      expect(revokeBlobUrl).toHaveBeenCalledWith(blobUrl);
    });
  });
});
