import { describe, it, expect, vi } from "vitest";
import { normalizeAudioUrlForPlayback } from "./audio-url";

vi.mock("@/lib/api/config", () => ({
  getApiUrl: () => "https://otter-music.pages.dev",
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

  it("keeps localhost http:// url unchanged (native proxy)", () => {
    expect(
      normalizeAudioUrlForPlayback(
        "http://localhost:8765/proxy?url=https%3A%2F%2Fexample.com%2Fa.m4s"
      )
    ).toBe("http://localhost:8765/proxy?url=https%3A%2F%2Fexample.com%2Fa.m4s");
  });

  it("keeps 127.0.0.1 http:// url unchanged", () => {
    expect(
      normalizeAudioUrlForPlayback("http://127.0.0.1:8765/proxy?url=test")
    ).toBe("http://127.0.0.1:8765/proxy?url=test");
  });
});
