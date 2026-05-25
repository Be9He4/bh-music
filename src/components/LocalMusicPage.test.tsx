import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { MusicTrack } from "@/types/music";
import { LocalMusicPlugin } from "@/plugins/local-music";
import { useLocalMusicStore } from "@/store/local-music-store";
import { LocalMusicPage } from "./LocalMusicPage";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@/plugins/local-music", () => ({
  LocalMusicPlugin: {
    scanLocalMusic: vi.fn(),
    scanAllStorage: vi.fn(),
    deleteLocalMusic: vi.fn(),
  },
}));

vi.mock("react-hot-toast", () => ({
  default: {
    promise: vi.fn((promise) => promise),
    error: vi.fn(),
  },
}));

vi.mock("@/components/PageLayout", () => ({
  PageLayout: ({
    children,
    action,
  }: {
    children: React.ReactNode;
    action?: React.ReactNode;
  }) => (
    <div>
      {action}
      {children}
    </div>
  ),
}));

const mocks = vi.hoisted(() => ({
  playlistView: vi.fn(),
}));

vi.mock("@/components/MusicPlaylistView", () => ({
  MusicPlaylistView: mocks.playlistView,
}));

vi.mock("@/components/LocalMusicPermissionDialog", () => ({
  LocalMusicPermissionDialog: () => null,
}));

describe("LocalMusicPage", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.playlistView.mockImplementation(
      ({
        tracks,
        onPlay,
        onRemove,
      }: {
        tracks: MusicTrack[];
        onPlay: (track: MusicTrack | null, index?: number) => void;
        onRemove?: (
          track: MusicTrack,
          silent?: boolean
        ) => void | Promise<void>;
      }) => (
        <div>
          {tracks.map((track) => (
            <div key={track.id}>
              <button type="button" onClick={() => onPlay(track)}>
                {track.name}
              </button>
              <button type="button" onClick={() => onRemove?.(track)}>
                delete {track.name}
              </button>
            </div>
          ))}
          <button type="button" onClick={() => onPlay(null)}>
            play all
          </button>
        </div>
      )
    );
    useLocalMusicStore.setState({
      files: [
        {
          id: "old",
          name: "Old Song",
          artist: "Artist",
          album: "Album",
          duration: 180000,
          localPath: "/music/old.mp3",
          fileSize: 1,
          modifiedTime: 1000,
        },
        {
          id: "missing-time",
          name: "Missing Time Song",
          artist: "Artist",
          album: "Album",
          duration: 180000,
          localPath: "/music/missing.mp3",
          fileSize: 1,
        },
        {
          id: "new",
          name: "New Song",
          artist: "Artist",
          album: "Album",
          duration: 180000,
          localPath: "/music/new.mp3",
          fileSize: 1,
          modifiedTime: 3000,
        },
      ],
      isScanning: false,
      scanType: null,
    });
    vi.mocked(LocalMusicPlugin.scanLocalMusic).mockResolvedValue({
      success: true,
      files: [],
    });
    vi.mocked(LocalMusicPlugin.scanAllStorage).mockResolvedValue({
      success: true,
      files: [],
    });
    vi.mocked(LocalMusicPlugin.deleteLocalMusic).mockResolvedValue({
      success: true,
    });
  });

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    container?.remove();
    root = undefined;
    container = undefined;
  });

  /** 渲染本地音乐页面并返回播放回调。 */
  function renderPage() {
    const onPlay = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(
        <LocalMusicPage
          onPlay={onPlay}
          currentTrackId={undefined}
          isPlaying={false}
        />
      );
    });

    return onPlay;
  }

  /** 等待当前 React 更新队列完成。 */
  async function flushReact() {
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("orders local tracks by modified time descending and keeps play queue in the same order", () => {
    const onPlay = renderPage();

    const tracks = mocks.playlistView.mock.calls.at(-1)?.[0]
      .tracks as MusicTrack[];
    expect(tracks.map((track) => track.name)).toEqual([
      "New Song",
      "Old Song",
      "Missing Time Song",
    ]);

    act(() => {
      const latestProps = mocks.playlistView.mock.calls.at(-1)?.[0];
      latestProps.onPlay(null);
    });

    expect(onPlay).toHaveBeenCalledWith(tracks[0], tracks, "local");
  });

  it("uses MediaStore scan on initial load when no cached local files exist", async () => {
    useLocalMusicStore.setState({ files: [] });

    renderPage();
    await flushReact();

    expect(LocalMusicPlugin.scanLocalMusic).toHaveBeenCalledTimes(1);
    expect(LocalMusicPlugin.scanAllStorage).not.toHaveBeenCalled();
  });

  it("uses all storage scan only when the user clicks full scan", async () => {
    renderPage();

    await act(async () => {
      Array.from(container?.querySelectorAll<HTMLButtonElement>("button") ?? [])
        .find((button) => button.textContent?.includes("全盘扫描"))
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(LocalMusicPlugin.scanAllStorage).toHaveBeenCalledTimes(1);
  });

  it("removes local track from the current list without deleting the file by default", async () => {
    renderPage();

    await act(async () => {
      container
        ?.querySelector<HTMLButtonElement>("button:nth-of-type(2)")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      document
        .querySelector<HTMLButtonElement>(
          "[data-testid='confirm-local-delete']"
        )
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(LocalMusicPlugin.deleteLocalMusic).not.toHaveBeenCalled();
    expect(
      useLocalMusicStore.getState().files.map((file) => file.localPath)
    ).not.toContain("/music/new.mp3");
  });

  it("deletes the physical file when delete file checkbox is checked", async () => {
    renderPage();

    await act(async () => {
      container
        ?.querySelector<HTMLButtonElement>("button:nth-of-type(2)")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      document
        .querySelector<HTMLButtonElement>("[data-testid='delete-local-file']")
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      document
        .querySelector<HTMLButtonElement>(
          "[data-testid='confirm-local-delete']"
        )
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(LocalMusicPlugin.deleteLocalMusic).toHaveBeenCalledWith({
      localPath: "/music/new.mp3",
    });
  });
});
