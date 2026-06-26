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

vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(() => vi.fn()),
}));

vi.mock("@/hooks/use-offline-playlist", () => ({
  useOfflinePlaylist: vi.fn(() => []),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/plugins/local-music", () => ({
  LocalMusicPlugin: {
    scanLocalMusic: vi.fn(),
    scanAllStorage: vi.fn(),
    deleteLocalMusic: vi.fn(),
    getExcludedFolders: vi.fn(),
    removeExcludedFolder: vi.fn(),
    pickExcludedDirectory: vi.fn(),
  },
}));

vi.mock("react-hot-toast", () => ({
  default: {
    promise: vi.fn((promise) => promise),
    error: vi.fn(),
  },
}));

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => (open ? <div data-testid="drawer">{children}</div> : null),
  DrawerContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drawer-content">{children}</div>
  ),
  DrawerHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DrawerTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
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
    vi.mocked(LocalMusicPlugin.getExcludedFolders).mockResolvedValue({
      success: true,
      folders: [],
    });
    vi.mocked(LocalMusicPlugin.pickExcludedDirectory).mockResolvedValue({
      success: false,
      error: "cancelled",
    });
    vi.mocked(LocalMusicPlugin.removeExcludedFolder).mockResolvedValue({
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

  /** 点击"全盘扫描"按钮打开 Drawer。 */
  function openScanDrawer() {
    const btn = Array.from(
      container?.querySelectorAll<HTMLButtonElement>("button") ?? []
    ).find((button) => button.textContent?.includes("全盘扫描"));
    if (!btn) throw new Error("全盘扫描 button not found");
    btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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

  it("opens scan drawer when header button is clicked; does not scan yet", async () => {
    renderPage();

    await act(async () => {
      openScanDrawer();
    });
    await flushReact();

    // Drawer 打开后不应直接触发扫描
    expect(LocalMusicPlugin.scanAllStorage).not.toHaveBeenCalled();
    // Drawer 内应展示确认按钮
    expect(
      container?.querySelector<HTMLButtonElement>(
        "[data-testid='confirm-full-scan']"
      )
    ).toBeTruthy();
  });

  it("triggers full scan only when confirming inside the drawer", async () => {
    renderPage();

    await act(async () => {
      openScanDrawer();
    });
    await flushReact();

    await act(async () => {
      container
        ?.querySelector<HTMLButtonElement>("[data-testid='confirm-full-scan']")
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
        .querySelector<HTMLButtonElement>("[data-testid='delete-local-file']")!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(async () => {
      document
        .querySelector<HTMLButtonElement>(
          "[data-testid='confirm-local-delete']"
        )!
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(LocalMusicPlugin.deleteLocalMusic).toHaveBeenCalledWith({
      localPath: "/music/new.mp3",
    });
  });

  /* =========================
     排除目录
  ========================= */

  it("loads excluded folders when drawer opens", async () => {
    vi.mocked(LocalMusicPlugin.getExcludedFolders).mockResolvedValue({
      success: true,
      folders: ["Recordings/Call", "通话录音"],
    });

    renderPage();
    await flushReact();

    expect(LocalMusicPlugin.getExcludedFolders).not.toHaveBeenCalled();

    await act(async () => {
      openScanDrawer();
    });
    await flushReact();

    expect(LocalMusicPlugin.getExcludedFolders).toHaveBeenCalledTimes(1);
    // Drawer 打开后,排除目录列表应展示已加载的目录
    const list = container?.querySelector<HTMLDivElement>(
      "[data-testid='excluded-folder-list']"
    );
    expect(list?.textContent).toContain("Recordings/Call");
    expect(list?.textContent).toContain("通话录音");
  });

  it("calls pickExcludedDirectory and reloads list on success", async () => {
    vi.mocked(LocalMusicPlugin.getExcludedFolders)
      .mockResolvedValueOnce({ success: true, folders: [] })
      .mockResolvedValueOnce({ success: true, folders: ["MIUI/Recorder"] });
    vi.mocked(LocalMusicPlugin.pickExcludedDirectory).mockResolvedValue({
      success: true,
      path: "MIUI/Recorder",
      uri: "content://tree/abc",
    });

    renderPage();
    await flushReact();

    await act(async () => {
      openScanDrawer();
    });
    await flushReact();

    await act(async () => {
      document
        .querySelector<HTMLButtonElement>(
          "[data-testid='excluded-folder-pick']"
        )
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    expect(LocalMusicPlugin.pickExcludedDirectory).toHaveBeenCalledTimes(1);
    // 成功后应重新拉取
    expect(LocalMusicPlugin.getExcludedFolders).toHaveBeenCalledTimes(2);
    const list = container?.querySelector<HTMLDivElement>(
      "[data-testid='excluded-folder-list']"
    );
    expect(list?.textContent).toContain("MIUI/Recorder");
  });

  it("removes an excluded folder and updates the list", async () => {
    vi.mocked(LocalMusicPlugin.getExcludedFolders).mockResolvedValue({
      success: true,
      folders: ["A/C", "B/D"],
    });

    renderPage();
    await flushReact();

    await act(async () => {
      openScanDrawer();
    });
    await flushReact();

    await act(async () => {
      const removeBtns = container?.querySelectorAll<HTMLButtonElement>(
        "[data-testid='excluded-folder-remove']"
      );
      removeBtns?.[0]?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    expect(LocalMusicPlugin.removeExcludedFolder).toHaveBeenCalledWith({
      folder: "A/C",
    });
    const list = container?.querySelector<HTMLDivElement>(
      "[data-testid='excluded-folder-list']"
    );
    expect(list?.textContent).toContain("B/D");
    expect(list?.textContent).not.toContain("A/C");
  });
});
