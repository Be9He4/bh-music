import { MusicTrack } from "@/types/music";
import { Directory } from "@capacitor/filesystem";
import type { AudioFormat } from "@otter-music/shared";

/**
 * 统一存储配置中心
 */
export const STORAGE_CONFIG = {
  // 根目录名称
  BASE_NAME: "OtterMusic",
  // 基础路径（相对于根）
  ROOT: "Download/OtterMusic",
  // 公共目录枚举
  BASE_DIR: Directory.ExternalStorage,
} as const;

/**
 * 集中管理所有业务路径
 */
export const AppPaths = {
  // 音乐文件存放处
  Music: STORAGE_CONFIG.ROOT,

  // 私有数据存放处（如 JSON 记录）
  Data: `${STORAGE_CONFIG.ROOT}/.data`,

  // 缓存存放处（如封面图片等）
  Cache: `${STORAGE_CONFIG.ROOT}/.cache`,

  // 歌单导出存放处
  Playlists: `${STORAGE_CONFIG.ROOT}/Playlists`,

  /**
   * 辅助方法：生成完整的文件路径
   */
  join: (base: string, fileName: string) => `${base}/${fileName}`,
};

export const DOWNLOAD_RECORDS_FILE = "downloads.json";

/**
 * 音频格式 → Blob MIME 映射
 * - mp3 → audio/mpeg
 * - m4a / m4s → audio/mp4 (fMP4)
 * - flv → video/x-flv
 */
export const AUDIO_MIME: Record<AudioFormat, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  m4s: "audio/mp4",
  flv: "video/x-flv",
};

export function buildFileName(track: MusicTrack) {
  const ext = track.audioFormat ?? "mp3";
  return sanitize(
    `${track.name} - ${track.artist?.join(" & ") || "Unknown"}.${ext}`
  );
}

function sanitize(name: string) {
  return name
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 获取当前下载目录（优先使用用户自定义目录，否则使用默认目录） */
export function getMusicPath(customDir?: string): string {
  if (customDir) {
    return `${STORAGE_CONFIG.ROOT}/${customDir}`.replace(/\/+/g, "/");
  }
  return AppPaths.Music;
}
