import { beforeEach, describe, expect, it, vi } from "vitest";
import toast from "react-hot-toast";
import { ApiError } from "@/lib/api/config";
import { useMusicStore } from "@/store";
import { useSyncStore } from "@/store/sync-store";
import { syncPull, syncPushAndPull } from "@/lib/api/sync";
import { checkAndSync } from "./sync";
import type { MusicTrack } from "@/types/music";

/* ---------------- mocks ---------------- */

vi.mock("@/lib/crypto-storage", () => ({
  encryptString: vi.fn(async (str) => `mock_${str}`),
  decryptString: vi.fn(async (str) => str.replace("mock_", "")),
}));

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("react-hot-toast", () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/lib/api/sync");

/* ---------------- helpers ---------------- */

// 固定时间，避免 flaky
const NOW = 4_000_000;

const createTrack = (id: string, is_deleted = false): MusicTrack => ({
  id,
  name: `Song ${id}`,
  artist: ["Artist"],
  album: "Album",
  pic_id: id,
  url_id: id,
  lyric_id: id,
  source: "netease",
  is_deleted,
});

const setupBaseState = () => {
  useSyncStore.setState({
    syncKey: "sync-key",
    lastSyncTime: 12345,
    version: 0,
  });

  useMusicStore.setState({
    favorites: [],
    playlists: [],
  });
};

const successResponse = (data: unknown, overrides = {}) => ({
  data,
  lastSyncTime: 99999,
  version: 1,
  ...overrides,
});

/* ---------------- tests ---------------- */

describe("checkAndSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 固定时间
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    setupBaseState();
  });

  it("skips when within throttle window", async () => {
    useSyncStore.setState({
      lastSyncTime: NOW - 1000,
    });

    await expect(checkAndSync()).resolves.toEqual({
      success: true,
      skipped: true,
    });

    expect(syncPushAndPull).not.toHaveBeenCalled();
  });

  it("clears sync config on 404", async () => {
    vi.mocked(syncPushAndPull).mockRejectedValue(new ApiError("missing", 404));

    await expect(checkAndSync()).resolves.toEqual({
      success: false,
      error: "密钥失效",
    });

    expect(useSyncStore.getState()).toMatchObject({
      syncKey: null,
      lastSyncTime: 0,
    });

    expect(toast.error).toHaveBeenCalledWith("同步密钥不存在或已失效");
  });

  it("applies snapshot on success (with version)", async () => {
    const data = {
      favorites: [{ id: "t1" }],
      playlists: [],
    };

    vi.mocked(syncPushAndPull).mockResolvedValue(successResponse(data));

    await expect(checkAndSync()).resolves.toEqual({
      success: true,
    });

    expect(useMusicStore.getState().favorites).toEqual(data.favorites);
    expect(useSyncStore.getState().version).toBe(1);
    expect(toast.success).toHaveBeenCalled();
  });

  it("sends clientVersion on push", async () => {
    vi.mocked(syncPushAndPull).mockResolvedValue(
      successResponse({ favorites: [], playlists: [] })
    );

    useSyncStore.setState({ version: 3 });
    await checkAndSync();

    expect(syncPushAndPull).toHaveBeenCalledWith(
      "sync-key",
      expect.anything(),
      3 // clientVersion
    );
  });

  it("does NOT fallback to pull on non-404 error", async () => {
    vi.mocked(syncPushAndPull).mockRejectedValue(
      new ApiError("server error", 500)
    );

    await expect(checkAndSync()).resolves.toEqual({
      success: false,
      error: "网络超时",
    });

    // 关键断言：不调用 pull
    expect(syncPull).not.toHaveBeenCalled();

    // 本地数据不变
    expect(useMusicStore.getState().favorites).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith("网络超时，请稍后重试");
  });

  it("recovers from 409 by pull + merge + retry", async () => {
    // 本地有数据
    useMusicStore.setState({
      favorites: [createTrack("local-1")],
      playlists: [],
    });

    // 第一次 POST 返回 409
    vi.mocked(syncPushAndPull)
      .mockRejectedValueOnce(new ApiError("version conflict", 409))
      // 重试成功
      .mockResolvedValueOnce(
        successResponse(
          {
            favorites: [createTrack("local-1"), createTrack("remote-1")],
            playlists: [],
          },
          { version: 2 }
        )
      );

    // Pull 返回远程数据
    vi.mocked(syncPull).mockResolvedValue(
      successResponse(
        { favorites: [createTrack("remote-1")], playlists: [] },
        { version: 1 }
      )
    );

    await expect(checkAndSync()).resolves.toEqual({
      success: true,
    });

    // Pull 被调用一次
    expect(syncPull).toHaveBeenCalledTimes(1);

    // 重试的 POST 使用合并后的数据
    expect(syncPushAndPull).toHaveBeenCalledTimes(2);
    expect(syncPushAndPull).toHaveBeenLastCalledWith(
      "sync-key",
      expect.objectContaining({
        favorites: expect.arrayContaining([
          expect.objectContaining({ id: "local-1" }),
          expect.objectContaining({ id: "remote-1" }),
        ]),
      }),
      expect.anything()
    );

    // 本地 state 更新
    expect(useSyncStore.getState().version).toBe(2);
  });

  it("409 recovery preserves local-only playlists", async () => {
    // 本地有云上没有的歌单
    useMusicStore.setState({
      favorites: [],
      playlists: [
        {
          id: "local-playlist-1",
          name: "本地歌单",
          createdAt: 1000,
          update_time: 2000,
          is_deleted: false,
          tracks: [],
        },
      ],
    });

    // 云端有另一个歌单
    const serverData = {
      favorites: [],
      playlists: [
        {
          id: "server-playlist-1",
          name: "云端歌单",
          createdAt: 500,
          update_time: 1500,
          is_deleted: false,
          tracks: [],
        },
      ],
    };

    // 第一次 POST 返回 409
    vi.mocked(syncPushAndPull)
      .mockRejectedValueOnce(new ApiError("version conflict", 409))
      // 重试成功
      .mockResolvedValueOnce(
        successResponse(
          {
            favorites: [],
            playlists: [
              {
                id: "local-playlist-1",
                name: "本地歌单",
                update_time: 2000,
                is_deleted: false,
                tracks: [],
              },
              {
                id: "server-playlist-1",
                name: "云端歌单",
                update_time: 1500,
                is_deleted: false,
                tracks: [],
              },
            ],
          },
          { version: 2 }
        )
      );

    // Pull 返回远程数据
    vi.mocked(syncPull).mockResolvedValue(
      successResponse(serverData, { version: 1 })
    );

    await expect(checkAndSync()).resolves.toEqual({
      success: true,
    });

    // 本地独有歌单应该保留
    const playlists = useMusicStore.getState().playlists;
    expect(playlists.some((p) => p.id === "local-playlist-1")).toBe(true);
    expect(playlists.some((p) => p.id === "server-playlist-1")).toBe(true);
  });

  it("409 recovery preserves local playlist field updates", async () => {
    // 本地更新了歌单名称
    useMusicStore.setState({
      favorites: [],
      playlists: [
        {
          id: "playlist-1",
          name: "本地更新的名称",
          createdAt: 1000,
          update_time: 3000,
          is_deleted: false,
          tracks: [],
        },
      ],
    });

    // 云端有同名歌单但名称不同
    const serverData = {
      favorites: [],
      playlists: [
        {
          id: "playlist-1",
          name: "云端旧名称",
          createdAt: 1000,
          update_time: 2000,
          is_deleted: false,
          tracks: [],
        },
      ],
    };

    vi.mocked(syncPushAndPull)
      .mockRejectedValueOnce(new ApiError("version conflict", 409))
      .mockResolvedValueOnce(
        successResponse(
          {
            favorites: [],
            playlists: [
              {
                id: "playlist-1",
                name: "本地更新的名称",
                update_time: 3000,
                is_deleted: false,
                tracks: [],
              },
            ],
          },
          { version: 2 }
        )
      );

    vi.mocked(syncPull).mockResolvedValue(
      successResponse(serverData, { version: 1 })
    );

    await expect(checkAndSync()).resolves.toEqual({
      success: true,
    });

    // 本地更新的歌单名称应该保留（update_time 更大的胜出）
    const playlist = useMusicStore
      .getState()
      .playlists.find((p) => p.id === "playlist-1");
    expect(playlist?.name).toBe("本地更新的名称");
  });

  it("keeps deleted markers in pushed snapshot", async () => {
    useMusicStore.setState({
      favorites: [createTrack("fav-1", true)],
      playlists: [
        {
          id: "playlist-1",
          name: "Test",
          createdAt: 1,
          is_deleted: false,
          tracks: [createTrack("track-1", true), createTrack("track-2")],
        },
      ],
    });

    const data = { favorites: [createTrack("fav-1", true)], playlists: [] };
    vi.mocked(syncPushAndPull).mockResolvedValue(successResponse(data));

    await expect(checkAndSync(true)).resolves.toEqual({ success: true });

    expect(syncPushAndPull).toHaveBeenCalledWith(
      "sync-key",
      expect.objectContaining({
        favorites: [expect.objectContaining({ id: "fav-1", is_deleted: true })],
        playlists: [
          expect.objectContaining({
            id: "playlist-1",
            tracks: expect.arrayContaining([
              expect.objectContaining({ id: "track-1", is_deleted: true }),
              expect.objectContaining({ id: "track-2", is_deleted: false }),
            ]),
          }),
        ],
      }),
      expect.anything()
    );
  });

  it("applies snapshot with deleted markers intact", async () => {
    const data = {
      favorites: [createTrack("t1", true)],
      playlists: [
        {
          id: "playlist-1",
          name: "Test",
          createdAt: 1,
          is_deleted: false,
          tracks: [createTrack("track-1", true)],
        },
      ],
    };

    vi.mocked(syncPushAndPull).mockResolvedValue(successResponse(data));

    await expect(checkAndSync()).resolves.toEqual({
      success: true,
    });

    expect(useMusicStore.getState().favorites).toEqual(data.favorites);
    expect(useMusicStore.getState().playlists).toEqual(data.playlists);
  });

  it("shows retry toast when 409 recovery fails", async () => {
    useMusicStore.setState({
      favorites: [createTrack("local-1")],
      playlists: [],
    });

    // POST 返回 409
    vi.mocked(syncPushAndPull).mockRejectedValue(
      new ApiError("version conflict", 409)
    );
    // Pull 也失败
    vi.mocked(syncPull).mockRejectedValue(new Error("pull failed"));

    await expect(checkAndSync()).resolves.toEqual({
      success: false,
      error: "网络超时",
    });

    // 本地数据保留
    expect(useMusicStore.getState().favorites).toHaveLength(1);
    expect(toast.error).toHaveBeenCalledWith("网络超时，请稍后重试");
  });
});
