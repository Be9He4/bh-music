import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MUSIC_API_URL,
  getApiUrl,
  getMusicApiUrls,
  getOrderedMusicApiUrls,
  markMusicApiUrlFailure,
  markMusicApiUrlSuccess,
  unwrap,
  setMusicApiUrls,
} from "./config";

describe("music api route policy", () => {
  beforeEach(() => {
    localStorage.clear();
    setMusicApiUrls([
      "https://primary.test/api.php",
      "https://backup.test/api.php",
    ]);
  });

  it("keeps primary first when all endpoints are healthy", () => {
    expect(getOrderedMusicApiUrls()).toEqual([
      "https://primary.test/api.php",
      "https://backup.test/api.php",
    ]);
  });

  it("moves failed endpoint behind healthy ones", () => {
    markMusicApiUrlFailure("https://primary.test/api.php", 1000);
    expect(getOrderedMusicApiUrls(1000)).toEqual([
      "https://backup.test/api.php",
      "https://primary.test/api.php",
    ]);
  });

  it("restores endpoint priority after success", () => {
    markMusicApiUrlFailure("https://primary.test/api.php", 1000);
    markMusicApiUrlSuccess("https://primary.test/api.php", 1001);
    expect(getOrderedMusicApiUrls(1001)).toEqual([
      "https://primary.test/api.php",
      "https://backup.test/api.php",
    ]);
  });

  it("preserves http status on non-ok responses", async () => {
    const response = new Response("missing", { status: 404 });

    await expect(unwrap(response)).rejects.toMatchObject({
      name: "ApiError",
      message: "missing",
      status: 404,
    });
  });
});

describe("music api default route policy", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns GD API first with proxied fallback when no custom URLs are configured", () => {
    const proxiedUrl = `${getApiUrl()}/music-api`;

    expect(getMusicApiUrls()).toEqual([DEFAULT_MUSIC_API_URL, proxiedUrl]);
  });

  it("keeps custom endpoint order when configured", () => {
    setMusicApiUrls([
      "https://custom-primary.test/api.php",
      DEFAULT_MUSIC_API_URL,
    ]);

    expect(getMusicApiUrls()).toEqual([
      "https://custom-primary.test/api.php",
      DEFAULT_MUSIC_API_URL,
    ]);
  });
});

describe("BH Music backend defaults", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
    localStorage.clear();
  });

  it("uses the deployed web origin in production", async () => {
    vi.stubEnv("PROD", true);
    vi.resetModules();
    const { Capacitor } = await import("@capacitor/core");
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    const config = await import("./config");
    expect(config.getApiUrl()).toBe(window.location.origin);
  });

  it("uses the BH backend on Android and preserves custom overrides", async () => {
    vi.stubEnv("PROD", true);
    vi.resetModules();
    const { Capacitor } = await import("@capacitor/core");
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    const config = await import("./config");
    expect(config.getApiUrl()).toBe("https://bh-music.pages.dev");
    config.setCustomApiUrl("https://custom.test");
    expect(config.getApiUrl()).toBe("https://custom.test");
    config.clearCustomApiUrl();
    expect(config.getApiUrl()).toBe("https://bh-music.pages.dev");
  });
});
