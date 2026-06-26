import { describe, it, expect, beforeEach, vi } from "vitest";
import { useUrlCacheStore, buildUrlCacheKey } from "./url-cache-store";

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
        [key]: "https://example.com/a.mp3",
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
});
