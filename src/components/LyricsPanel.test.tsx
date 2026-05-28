import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LyricsPanel } from "./LyricsPanel";
import type { MusicTrack } from "@/types/music";

vi.mock("@/store/music-store", () => ({
  useMusicStore: vi.fn(() => ({
    currentAudioTime: 0,
    seek: vi.fn(),
    seekTimestamp: 0,
  })),
}));

const bilibiliTrack: MusicTrack = {
  id: "bilibili_BV1xx411c7mD",
  name: "Test Bilibili Video",
  artist: ["UP主"],
  album: "",
  pic_id: "https://example.com/pic.jpg",
  url_id: "bilibili_BV1xx411c7mD",
  lyric_id: "",
  source: "bilibili",
};

const neteaseTrack: MusicTrack = {
  id: "netease_123456",
  name: "Test Song",
  artist: ["Artist"],
  album: "Album",
  pic_id: "pic-1",
  url_id: "url-1",
  lyric_id: "lyric-1",
  source: "netease",
};

describe("LyricsPanel", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  const renderPanel = (track: MusicTrack | null) => {
    act(() => {
      root!.render(<LyricsPanel track={track} />);
    });
  };

  const cleanup = () => {
    if (root) {
      act(() => {
        root?.unmount();
      });
    }
    container?.remove();
    root = undefined;
    container = undefined;
  };

  it("当 track 为 null 时显示提示", () => {
    renderPanel(null);
    expect(container?.textContent).toContain("选择歌曲查看歌词");
    cleanup();
  });

  it("B 站音源 lyric_id 为空时显示暂无歌词", async () => {
    renderPanel(bilibiliTrack);

    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container?.textContent).toContain("暂无歌词");
    cleanup();
  });

  it("B 站音源不会显示加载中", async () => {
    renderPanel(bilibiliTrack);

    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container?.textContent).not.toContain("加载歌词中...");
    cleanup();
  });

  it("正常音源加载歌词时显示加载中", () => {
    renderPanel(neteaseTrack);
    expect(container?.textContent).toContain("加载歌词中...");
    cleanup();
  });
});
