import {
  useMusicStore,
  type FullScreenBackgroundMode,
} from "@/store/music-store";
import { cleanTrack } from "@/lib/utils/music";
import { withMeta } from "@/store/music-store/shared";
import type {
  MusicTrack,
  Playlist,
  MusicSource,
  SourceConfig,
} from "@/types/music";

/** 备份数据版本号 */
const CURRENT_VERSION = 1;

/** 备份 JSON 顶层结构 */
interface BackupEnvelope {
  version: number;
  type: "bh-music-backup";
  exportedAt: number;
  data: BackupPayload;
}

/** 备份负载 —— 与 partialize 字段对齐 */
interface BackupPayload {
  favorites: MusicTrack[];
  playlists: Playlist[];
  volume: number;
  isRepeat: boolean;
  isShuffle: boolean;
  quality: string;
  searchSource: MusicSource;
  sourceConfigs: SourceConfig[];
  lastPlaylistCategory: string;
  lastMineTab: "recommend" | "created" | "subscribed" | "albums";
  lastFeaturedTab: string;
  enableAutoMatch: boolean;
  autoMatchFavorites: boolean;
  autoMatchPlaylists: boolean;
  bilibiliKeepOriginalMeta: boolean;
  bilibiliAutoMatchSuffix: string;
  fullScreenBackgroundMode: FullScreenBackgroundMode;
  showSourceBadge: boolean;
  downloadQuality: string;
  embedCover: boolean;
  embedLyric: boolean;
  downloadDirectory: string;
  sleepTimerDuration: number;
  playbackSpeed: number;
}

/** 校验成功结果 */
export interface ValidBackupResult {
  valid: true;
  data: BackupPayload;
  summary: { favoritesCount: number; playlistsCount: number };
}

/** 校验失败结果 */
export interface InvalidBackupResult {
  valid: false;
  error: string;
}

export type BackupValidationResult = ValidBackupResult | InvalidBackupResult;

/**
 * 过滤软删除项，清洗 track 数据
 */
function filterActive(tracks: MusicTrack[]): MusicTrack[] {
  return tracks.filter((t) => !t.is_deleted).map(cleanTrack);
}

/**
 * 从当前 Store 序列化全部持久化数据为 JSON 字符串
 */
export function serializeStoreData(): string {
  const state = useMusicStore.getState();

  const payload: BackupPayload = {
    favorites: filterActive(state.favorites),
    playlists: state.playlists
      .filter((p) => !p.is_deleted)
      .map((p) => ({
        ...p,
        tracks: filterActive(p.tracks),
      })),
    volume: state.volume,
    isRepeat: state.isRepeat,
    isShuffle: state.isShuffle,
    quality: state.quality,
    searchSource: state.searchSource,
    sourceConfigs: state.sourceConfigs,
    lastPlaylistCategory: state.lastPlaylistCategory,
    lastMineTab: state.lastMineTab,
    lastFeaturedTab: state.lastFeaturedTab,
    enableAutoMatch: state.enableAutoMatch,
    autoMatchFavorites: state.autoMatchFavorites,
    autoMatchPlaylists: state.autoMatchPlaylists,
    bilibiliKeepOriginalMeta: state.bilibiliKeepOriginalMeta,
    bilibiliAutoMatchSuffix: state.bilibiliAutoMatchSuffix,
    fullScreenBackgroundMode: state.fullScreenBackgroundMode,
    showSourceBadge: state.showSourceBadge,
    downloadQuality: state.downloadQuality,
    embedCover: state.embedCover,
    embedLyric: state.embedLyric,
    downloadDirectory: state.downloadDirectory,
    sleepTimerDuration: state.sleepTimerDuration,
    playbackSpeed: state.playbackSpeed,
  };

  const envelope: BackupEnvelope = {
    version: CURRENT_VERSION,
    type: "bh-music-backup",
    exportedAt: Date.now(),
    data: payload,
  };

  return JSON.stringify(envelope, null, 2);
}

/**
 * 校验 MusicTrack 基本结构
 */
function isValidTrack(t: unknown): t is MusicTrack {
  if (typeof t !== "object" || t === null) return false;
  const track = t as Record<string, unknown>;
  return (
    typeof track.id === "string" &&
    typeof track.name === "string" &&
    typeof track.source === "string"
  );
}

/**
 * 校验 Playlist 基本结构
 */
function isValidPlaylist(p: unknown): p is Playlist {
  if (typeof p !== "object" || p === null) return false;
  const pl = p as Record<string, unknown>;
  return (
    typeof pl.id === "string" &&
    typeof pl.name === "string" &&
    Array.isArray(pl.tracks)
  );
}

/**
 * 校验并解析备份 JSON 字符串
 * 成功时返回解析后的数据及预览摘要
 */
export function validateBackupData(raw: string): BackupValidationResult {
  if (!raw || !raw.trim()) {
    return { valid: false, error: "输入内容为空" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, error: "JSON 格式无效，请检查是否包含非法字符" };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { valid: false, error: "数据格式不正确，应为 JSON 对象" };
  }

  const envelope = parsed as Record<string, unknown>;

  // 校验 version
  if (typeof envelope.version !== "number") {
    return { valid: false, error: "缺少或无效的版本号 (version)" };
  }
  if (envelope.version !== CURRENT_VERSION) {
    return {
      valid: false,
      error: `不支持的备份版本 ${envelope.version}，当前仅支持 v${CURRENT_VERSION}`,
    };
  }

  // 校验 type（可选但建议）
  if (envelope.type !== "bh-music-backup") {
    return { valid: false, error: "数据格式不匹配，缺少正确的 type 标识" };
  }

  // 校验 data
  const data = envelope.data;
  if (typeof data !== "object" || data === null) {
    return { valid: false, error: "缺少数据内容 (data)" };
  }

  const payload = data as Record<string, unknown>;

  // 校验 favorites
  const favorites = payload.favorites;
  if (favorites !== undefined && !Array.isArray(favorites)) {
    return { valid: false, error: "收藏数据 (favorites) 格式错误" };
  }

  // 校验 playlists
  const playlists = payload.playlists;
  if (playlists === undefined || !Array.isArray(playlists)) {
    return { valid: false, error: "歌单数据 (playlists) 缺失或格式错误" };
  }
  for (let i = 0; i < playlists.length; i++) {
    if (!isValidPlaylist(playlists[i])) {
      return {
        valid: false,
        error: `第 ${i + 1} 个歌单数据格式不正确`,
      };
    }
  }

  // 校验标量字段类型，防止畸形备份腐蚀 store
  // （?? 兜底只拦 null/undefined，不拦错类型，如 volume:"high" 会让 volume*100=NaN）
  const scalarChecks: Array<[string, "number" | "string" | "boolean"]> = [
    ["volume", "number"],
    ["isRepeat", "boolean"],
    ["isShuffle", "boolean"],
    ["quality", "string"],
    ["searchSource", "string"],
    ["lastPlaylistCategory", "string"],
    ["lastMineTab", "string"],
    ["lastFeaturedTab", "string"],
    ["enableAutoMatch", "boolean"],
    ["autoMatchFavorites", "boolean"],
    ["autoMatchPlaylists", "boolean"],
    ["bilibiliKeepOriginalMeta", "boolean"],
    ["bilibiliAutoMatchSuffix", "string"],
    ["fullScreenBackgroundMode", "string"],
    ["showSourceBadge", "boolean"],
    ["downloadQuality", "string"],
    ["embedCover", "boolean"],
    ["embedLyric", "boolean"],
    ["downloadDirectory", "string"],
    ["sleepTimerDuration", "number"],
    ["playbackSpeed", "number"],
  ];
  for (const [key, kind] of scalarChecks) {
    const v = (payload as Record<string, unknown>)[key];
    if (v === undefined) continue; // 缺失字段走默认值
    if (typeof v !== kind) {
      return { valid: false, error: `字段 ${key} 类型不正确` };
    }
  }
  if (
    payload.sourceConfigs !== undefined &&
    !Array.isArray(payload.sourceConfigs)
  ) {
    return { valid: false, error: "字段 sourceConfigs 类型不正确" };
  }

  // 过滤无效 track
  const validFavorites = Array.isArray(favorites)
    ? favorites.filter(isValidTrack)
    : [];
  const validPlaylists = (playlists as unknown[]).map((p) => ({
    ...(p as Playlist),
    tracks: ((p as Playlist).tracks || []).filter(isValidTrack),
  }));

  return {
    valid: true,
    data: {
      ...(payload as unknown as BackupPayload),
      favorites: validFavorites,
      playlists: validPlaylists,
    },
    summary: {
      favoritesCount: validFavorites.length,
      playlistsCount: validPlaylists.length,
    },
  };
}

/**
 * 将备份数据写入 Store（全量替换）
 * 播放列表逐条创建以兼容 createPlaylist 逻辑
 */
export function importStoreData(payload: BackupPayload): void {
  // 原子导入：在内存中构造完整的新状态，再一次 setState 写入。
  // 避免原实现"先逐条软删旧歌单、再逐条 createPlaylist"多次持久化，
  // 中断（崩溃/关页/异常）时旧歌单已删、新歌单未建完 → 数据永久丢失。
  // 保留原"软删旧歌单可恢复"语义，但在内存中构造后一次写入。
  const state = useMusicStore.getState();
  const oldPlaylistsSoftDeleted = state.playlists.map((pl) => ({
    ...pl,
    is_deleted: true,
    update_time: Date.now(),
  }));

  const newFavorites = payload.favorites.map((t) => ({
    ...withMeta(t),
    is_deleted: false,
  }));

  const newPlaylists = payload.playlists.map((pl) => ({
    id: crypto.randomUUID(),
    name: pl.name,
    coverUrl: pl.coverUrl,
    description: pl.description, // 保留 description（原 createPlaylist 仅取 name/coverUrl 会丢）
    tracks: pl.tracks.map((t) => ({ ...withMeta(t), is_deleted: false })),
    createdAt: pl.createdAt ?? Date.now(), // 保留原始创建时间（原 createPlaylist 会重置为 now）
    update_time: Date.now(),
    is_deleted: false,
  }));

  // 单次 setState = 单次持久化写入，原子
  useMusicStore.setState({
    favorites: newFavorites,
    playlists: [...oldPlaylistsSoftDeleted, ...newPlaylists],
    // 播放设置
    volume: payload.volume ?? 1.0,
    isRepeat: payload.isRepeat ?? false,
    isShuffle: payload.isShuffle ?? false,
    // UI 设置
    quality: payload.quality ?? "192",
    searchSource: payload.searchSource ?? "all",
    sourceConfigs: payload.sourceConfigs ?? [],
    lastPlaylistCategory: payload.lastPlaylistCategory ?? "全部",
    lastMineTab: payload.lastMineTab ?? "recommend",
    lastFeaturedTab: payload.lastFeaturedTab ?? "",
    enableAutoMatch: payload.enableAutoMatch ?? true,
    autoMatchFavorites: payload.autoMatchFavorites ?? false,
    autoMatchPlaylists: payload.autoMatchPlaylists ?? true,
    bilibiliKeepOriginalMeta: payload.bilibiliKeepOriginalMeta ?? false,
    bilibiliAutoMatchSuffix: payload.bilibiliAutoMatchSuffix ?? "高音质 原曲",
    fullScreenBackgroundMode: payload.fullScreenBackgroundMode ?? "theme",
    showSourceBadge: payload.showSourceBadge ?? true,
    playbackSpeed: payload.playbackSpeed ?? 1.0,
    downloadQuality: payload.downloadQuality ?? "320",
    embedCover: payload.embedCover ?? true,
    embedLyric: payload.embedLyric ?? true,
    downloadDirectory: payload.downloadDirectory ?? "",
    sleepTimerDuration: payload.sleepTimerDuration ?? 30,
  });
}
