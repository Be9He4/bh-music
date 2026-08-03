import { IMusicProvider } from "../interface";
import {
  MusicTrack,
  SearchPageResult,
  SongLyric,
  SearchIntent,
} from "@/types/music";
import { getRawUrl } from "@/lib/alist";
import { useAlistStore } from "@/store/alist-store";
import type { AlistServer } from "@/types/alist";
import { logger } from "@/lib/logger";

/** Track.id 前缀 */
const ALIST_ID_PREFIX = "alist:";

/**
 * 从 track.id 解析出 serverId
 * id 格式：alist:<serverId>:<fullPath>
 */
function parseServerIdFromTrack(track: MusicTrack): string | null {
  if (!track.id.startsWith(ALIST_ID_PREFIX)) return null;
  const rest = track.id.slice(ALIST_ID_PREFIX.length);
  const colonIdx = rest.indexOf(":");
  if (colonIdx === -1) return null;
  return rest.slice(0, colonIdx);
}

/**
 * 从 track.id 解析出文件路径（serverId 后的全部内容）
 * 注意：不能依赖 track.url_id —— music-api 会用 id 重建 track，
 * 可能把带前缀的 id 写入 url_id。
 */
function parseFilePathFromTrack(track: MusicTrack): string | null {
  if (!track.id.startsWith(ALIST_ID_PREFIX)) return null;
  const rest = track.id.slice(ALIST_ID_PREFIX.length);
  const colonIdx = rest.indexOf(":");
  if (colonIdx === -1) return null;
  return rest.slice(colonIdx + 1);
}

/** 根据 track 反查所属的 Alist 站点配置 */
function resolveServerFromTrack(track: MusicTrack): AlistServer | null {
  const serverId = parseServerIdFromTrack(track);
  if (!serverId) return null;
  const server = useAlistStore
    .getState()
    .servers.find((s) => s.id === serverId && !s.is_deleted);
  return server || null;
}

/**
 * Alist 音源 Provider
 * - getUrl：调 /api/fs/get 把文件 path 解析为 raw_url 直链
 * - search：返回空（Alist 需指定 server，全局 search 无法定位单 server；已排除聚合）
 * - getPic/getLyric：Alist 无元数据，返回 null
 */
export class AlistProvider implements IMusicProvider {
  source = "alist" as const;

  async search(
    _query: string,
    _page: number,
    _count: number,
    _signal?: AbortSignal,
    _intent?: SearchIntent
  ): Promise<SearchPageResult<MusicTrack>> {
    return { items: [], hasMore: false };
  }

  async getUrl(track: MusicTrack, _br?: number): Promise<string | null> {
    const server = resolveServerFromTrack(track);
    if (!server) {
      logger.warn("alist", "getUrl: server not found for track", track.id);
      return null;
    }
    // 文件路径必须从 track.id 解析（url_id 可能被 music-api 重写为带前缀的 id）
    const filePath = parseFilePathFromTrack(track);
    if (!filePath) return null;
    return getRawUrl(server, filePath);
  }

  async getPic(_track: MusicTrack, _size?: number): Promise<string | null> {
    return null;
  }

  async getLyric(_track: MusicTrack): Promise<SongLyric | null> {
    return null;
  }
}
