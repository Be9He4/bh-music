import { describe, it, expect, beforeEach, vi } from "vitest";
import { useMusicStore } from "@/store/music-store";
import {
  serializeStoreData,
  validateBackupData,
  importStoreData,
} from "./data-backup";
import type { MusicTrack, Playlist } from "@/types/music";

// Mock 持久化与 toast，避免触碰 IndexedDB / UI 副作用
vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));
vi.mock("@/lib/utils/toast", () => ({
  toastUtils: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const createTrack = (id: string, title: string): MusicTrack => ({
  id,
  name: title,
  artist: ["Artist"],
  album: "Album",
  pic_id: id,
  url_id: id,
  lyric_id: id,
  source: "netease",
});

const envelope = (data: Record<string, unknown>, overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    version: 1,
    type: "bh-music-backup",
    data,
    ...overrides,
  });

describe("data-backup", () => {
  beforeEach(() => {
    useMusicStore.setState({
      favorites: [],
      playlists: [],
      queue: [],
      originalQueue: [],
      currentIndex: 0,
      isShuffle: false,
      isPlaying: false,
      currentAudioTime: 0,
      fullScreenBackgroundMode: "theme",
    });
    vi.clearAllMocks();
  });

  describe("validateBackupData", () => {
    it("rejects empty input", () => {
      expect(validateBackupData("").valid).toBe(false);
      expect(validateBackupData("   ").valid).toBe(false);
    });

    it("rejects invalid JSON", () => {
      expect(validateBackupData("{not json").valid).toBe(false);
    });

    it("rejects non-object root", () => {
      expect(validateBackupData('"string"').valid).toBe(false);
      expect(validateBackupData("123").valid).toBe(false);
    });

    it("rejects wrong version", () => {
      const r = validateBackupData(envelope({ playlists: [] }, { version: 99 }));
      expect(r.valid).toBe(false);
    });

    it("accepts bh and otter type tags (compat)", () => {
      // 同步上游后兼容 otter-music-backup 标识的备份
      const bh = validateBackupData(
        JSON.stringify({ version: 1, type: "bh-music-backup", data: { playlists: [] } })
      );
      expect(bh.valid).toBe(true);
      const otter = validateBackupData(
        JSON.stringify({ version: 1, type: "otter-music-backup", data: { playlists: [] } })
      );
      expect(otter.valid).toBe(true);
    });

    it("rejects unknown type tag", () => {
      const r = validateBackupData(
        JSON.stringify({ version: 1, type: "unknown-backup", data: { playlists: [] } })
      );
      expect(r.valid).toBe(false);
    });

    it("rejects missing playlists", () => {
      expect(validateBackupData(envelope({})).valid).toBe(false);
    });

    it("rejects malformed playlist (missing id/name)", () => {
      const r = validateBackupData(envelope({ playlists: [{ tracks: [] }] }));
      expect(r.valid).toBe(false);
    });

    it("rejects wrong-type scalar (volume as string)", () => {
      const r = validateBackupData(envelope({ playlists: [], volume: "high" }));
      expect(r.valid).toBe(false);
    });

    it("rejects non-array sourceConfigs", () => {
      const r = validateBackupData(envelope({ playlists: [], sourceConfigs: "no" }));
      expect(r.valid).toBe(false);
    });

    it("filters invalid tracks from favorites and playlists", () => {
      const valid = createTrack("1", "S1");
      const json = envelope({
        favorites: [valid, { notId: true }],
        playlists: [{ id: "p", name: "P", tracks: [valid, { bad: true }] }],
      });
      const r = validateBackupData(json);
      expect(r.valid).toBe(true);
      if (r.valid) {
        expect(r.data.favorites).toHaveLength(1);
        expect(r.data.playlists[0].tracks).toHaveLength(1);
        expect(r.summary.favoritesCount).toBe(1);
        expect(r.summary.playlistsCount).toBe(1);
      }
    });
  });

  describe("serialize / import round-trip", () => {
    it("preserves description and createdAt, assigns fresh id", () => {
      const t = createTrack("1", "Song 1");
      const oldCreatedAt = 1700000000000;
      const pl: Playlist = {
        id: "p1",
        name: "Road Trip",
        tracks: [t],
        createdAt: oldCreatedAt,
        coverUrl: "cover.jpg",
        description: "Summer mix",
      };
      useMusicStore.setState({ favorites: [t], playlists: [pl] });

      const json = serializeStoreData();
      const result = validateBackupData(json);
      expect(result.valid).toBe(true);
      if (!result.valid) return;

      // 清空后导入
      useMusicStore.setState({ favorites: [], playlists: [] });
      importStoreData(result.data);

      const state = useMusicStore.getState();
      expect(state.favorites).toHaveLength(1);
      expect(state.favorites[0].id).toBe("1");

      const active = state.playlists.filter((p) => !p.is_deleted);
      expect(active).toHaveLength(1);
      const imported = active[0];
      expect(imported.name).toBe("Road Trip");
      expect(imported.description).toBe("Summer mix"); // 保留
      expect(imported.createdAt).toBe(oldCreatedAt); // 保留（未被重置为 now）
      expect(imported.coverUrl).toBe("cover.jpg");
      expect(imported.id).not.toBe("p1"); // 新 id
    });

    it("import soft-deletes old playlists and adds new ones", () => {
      const oldA: Playlist = {
        id: "a",
        name: "Old A",
        tracks: [],
        createdAt: 1,
      };
      // 先用 B 状态生成备份
      useMusicStore.setState({
        playlists: [
          { id: "b", name: "New B", tracks: [], createdAt: 2 },
        ],
      });
      const result = validateBackupData(serializeStoreData());
      expect(result.valid).toBe(true);
      if (!result.valid) return;

      // 恢复成只有旧歌单 A，再导入 B 的备份
      useMusicStore.setState({ playlists: [oldA] });
      importStoreData(result.data);

      const state = useMusicStore.getState();
      const old = state.playlists.find((p) => p.name === "Old A");
      expect(old?.is_deleted).toBe(true); // 旧歌单软删（可恢复）

      const active = state.playlists.filter((p) => !p.is_deleted);
      expect(active).toHaveLength(1);
      expect(active[0].name).toBe("New B");
      expect(active[0].id).not.toBe("b"); // 新 id
    });

    it("applies scalar settings from backup", () => {
      // 用含特定设置的 store 生成备份
      useMusicStore.setState({
        playlists: [{ id: "x", name: "P", tracks: [], createdAt: 1 } as Playlist],
        volume: 0.7,
        isRepeat: true,
        quality: "999",
        searchSource: "netease",
        fullScreenBackgroundMode: "cover",
        playbackSpeed: 1.5,
      });
      const result = validateBackupData(serializeStoreData());
      expect(result.valid).toBe(true);
      if (!result.valid) return;

      // 重置后导入
      useMusicStore.setState({
        volume: 1,
        isRepeat: false,
        quality: "192",
        searchSource: "all",
        fullScreenBackgroundMode: "theme",
        playbackSpeed: 1,
      });
      importStoreData(result.data);

      const s = useMusicStore.getState();
      expect(s.volume).toBe(0.7);
      expect(s.isRepeat).toBe(true);
      expect(s.quality).toBe("999");
      expect(s.searchSource).toBe("netease");
      expect(s.fullScreenBackgroundMode).toBe("cover");
      expect(s.playbackSpeed).toBe(1.5);
    });
  });
});
