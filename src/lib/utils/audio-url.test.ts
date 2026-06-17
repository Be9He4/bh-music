import { describe, it, expect, vi } from "vitest";
import {
  extractOriginalAudioUrl,
  normalizeAudioUrlForPlayback,
} from "./audio-url";

vi.mock("@/lib/api/config", () => ({
  getProxyUrl: (url: string) =>
    `https://otter-music.pages.dev/proxy?url=${encodeURIComponent(url)}`,
  isProxyUrl: (url: string) => {
    try {
      return (
        new URL(url, "https://otter-music.pages.dev").pathname === "/proxy"
      );
    } catch {
      return false;
    }
  },
}));

describe("extractOriginalAudioUrl", () => {
  it("extracts url from proxy url", () => {
    expect(
      extractOriginalAudioUrl(
        "https://otter-music.pages.dev/proxy?url=http%3A%2F%2Fbd-er.kuwo.cn%2Fa.mp3"
      )
    ).toBe("http://bd-er.kuwo.cn/a.mp3");
  });

  it("extracts url from proxy url with different backend", () => {
    expect(
      extractOriginalAudioUrl(
        "https://old-backend.example.com/proxy?url=http%3A%2F%2Fbd-er.kuwo.cn%2Fa.mp3"
      )
    ).toBe("http://bd-er.kuwo.cn/a.mp3");
  });

  it("returns non-proxy url as-is", () => {
    expect(extractOriginalAudioUrl("http://bd-er.kuwo.cn/a.mp3")).toBe(
      "http://bd-er.kuwo.cn/a.mp3"
    );
  });
});

describe("normalizeAudioUrlForPlayback", () => {
  it("converts http:// to current proxy", () => {
    expect(normalizeAudioUrlForPlayback("http://bd-er.kuwo.cn/a.mp3")).toBe(
      "https://otter-music.pages.dev/proxy?url=http%3A%2F%2Fbd-er.kuwo.cn%2Fa.mp3"
    );
  });

  it("refreshes old proxy url with current backend", () => {
    expect(
      normalizeAudioUrlForPlayback(
        "https://old-backend.example.com/proxy?url=http%3A%2F%2Fbd-er.kuwo.cn%2Fa.mp3"
      )
    ).toBe(
      "https://otter-music.pages.dev/proxy?url=http%3A%2F%2Fbd-er.kuwo.cn%2Fa.mp3"
    );
  });

  it("keeps current proxy url unchanged", () => {
    expect(
      normalizeAudioUrlForPlayback(
        "https://otter-music.pages.dev/proxy?url=http%3A%2F%2Fbd-er.kuwo.cn%2Fa.mp3"
      )
    ).toBe(
      "https://otter-music.pages.dev/proxy?url=http%3A%2F%2Fbd-er.kuwo.cn%2Fa.mp3"
    );
  });

  it("keeps https direct url unchanged", () => {
    expect(normalizeAudioUrlForPlayback("https://example.com/a.mp3")).toBe(
      "https://example.com/a.mp3"
    );
  });

  it("keeps blob url unchanged", () => {
    expect(normalizeAudioUrlForPlayback("blob:abc")).toBe("blob:abc");
  });

  it("keeps capacitor url unchanged", () => {
    expect(normalizeAudioUrlForPlayback("capacitor://file")).toBe(
      "capacitor://file"
    );
  });
});
