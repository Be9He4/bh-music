import type { MusicTrack } from "@/types/music";
import { useMusicStore } from "@/store/music-store";
import { logger } from "@/lib/logger";

/**
 * Apple Music 曲目信息
 */
export interface AppleMusicTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  artworkUrl?: string;
}

/**
 * Apple Music 歌单信息
 */
export interface AppleMusicPlaylist {
  id: string;
  name: string;
  description?: string;
  artworkUrl?: string;
  tracks: AppleMusicTrack[];
  curator?: string;
}

/**
 * 从 Apple Music 分享 URL 解析歌单 ID
 * 支持格式：
 * - https://music.apple.com/cn/playlist/xxx/pl.playlist-id
 * - https://music.apple.com/pl.playlist.xxx
 *
 * @param url Apple Music 分享链接
 * @returns 歌单 ID 或 null
 */
export function parsePlaylistId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Web URL: /cn/playlist/name/pl.1234567890 或 pl.abcDEF123
    const webMatch = pathname.match(/\/playlist\/[^/]+\/(pl\.[a-zA-Z0-9_-]+)/);
    if (webMatch) return webMatch[1];

    // Short URL: /pl.playlist.xxx
    const shortMatch = pathname.match(/\/(pl\.playlist\.[a-zA-Z0-9_-]+)/);
    if (shortMatch) return shortMatch[1];

    return null;
  } catch {
    return null;
  }
}

/**
 * 从 Apple Music 分享 URL 解析地区代码
 * 例如 /cn/playlist/... → "cn"，/us/playlist/... → "us"
 * 无地区信息的短链接默认返回 "cn"
 *
 * @param url Apple Music 分享链接
 * @returns 地区代码
 */
export function parsePlaylistRegion(url: string): string {
  try {
    const match = url.match(/music\.apple\.com\/([a-z]{2})\/playlist\//);
    return match ? match[1] : "cn";
  } catch {
    return "cn";
  }
}

/**
 * 从 Apple Music 页面获取歌单数据
 *
 * @param pageUrl Apple Music 歌单页面完整 URL（必须包含名称 slug）
 * @returns 歌单信息
 */
export async function fetchPlaylist(
  pageUrl: string
): Promise<AppleMusicPlaylist> {
  logger.info("apple-music", "Fetching playlist", { pageUrl });

  const playlistId = parsePlaylistId(pageUrl) || "unknown";

  try {
    const response = await fetch(pageUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();

    // 尝试从 JSON-LD 解析
    const jsonLdMatch = html.match(
      /<script[^>]*type="application\/ld\+json"[^>]*>(.+?)<\/script>/s
    );
    if (jsonLdMatch) {
      try {
        const data = JSON.parse(jsonLdMatch[1]);
        if (
          data["@type"] === "MusicPlaylist" ||
          data.type === "MusicPlaylist"
        ) {
          return parseJsonLdPlaylist(data, playlistId);
        }
      } catch (e) {
        logger.warn("apple-music", "Failed to parse JSON-LD", e);
      }
    }

    // 尝试从页面数据解析
    const pageDataMatch = html.match(
      /<script[^>]*>.*?window\.__INITIAL_STATE__\s*=\s*(\{.+?\});.*?<\/script>/s
    );
    if (pageDataMatch) {
      try {
        const data = JSON.parse(pageDataMatch[1]);
        return parsePageDataPlaylist(data, playlistId);
      } catch (e) {
        logger.warn("apple-music", "Failed to parse page data", e);
      }
    }

    throw new Error("无法解析歌单数据，请检查链接是否正确");
  } catch (error) {
    logger.error("apple-music", "Failed to fetch playlist", error);
    throw error;
  }
}

/**
 * 解析 JSON-LD 格式的歌单数据
 */
function parseJsonLdPlaylist(
  data: Record<string, unknown>,
  playlistId: string
): AppleMusicPlaylist {
  const tracks: AppleMusicTrack[] = [];

  const trackData = data.track || data.tracks;
  if (Array.isArray(trackData)) {
    for (const item of trackData) {
      if (typeof item === "object" && item !== null) {
        const track = parseTrackItem(item as Record<string, unknown>);
        if (track) tracks.push(track);
      }
    }
  }

  return {
    id: playlistId,
    name: String(data.name || data.title || "未知歌单"),
    description: data.description ? String(data.description) : undefined,
    artworkUrl: extractArtworkUrl(data.image || data.thumbnail),
    tracks,
    curator: data.author
      ? String((data.author as Record<string, unknown>).name || "")
      : undefined,
  };
}

/**
 * 解析页面数据格式的歌单数据
 */
function parsePageDataPlaylist(
  data: Record<string, unknown>,
  playlistId: string
): AppleMusicPlaylist {
  // 尝试不同的数据结构路径
  const playlist = data.playlist || data.data || data;

  const tracks: AppleMusicTrack[] = [];
  const trackList =
    (playlist as Record<string, unknown>).tracks ||
    (playlist as Record<string, unknown>).data ||
    (playlist as Record<string, unknown>).items;

  if (Array.isArray(trackList)) {
    for (const item of trackList) {
      if (typeof item === "object" && item !== null) {
        const track = parseTrackItem(item as Record<string, unknown>);
        if (track) tracks.push(track);
      }
    }
  }

  return {
    id: playlistId,
    name: String(
      (playlist as Record<string, unknown>).name ||
        (playlist as Record<string, unknown>).title ||
        "未知歌单"
    ),
    description: (playlist as Record<string, unknown>).description
      ? String((playlist as Record<string, unknown>).description)
      : undefined,
    artworkUrl: extractArtworkUrl(
      (playlist as Record<string, unknown>).artwork ||
        (playlist as Record<string, unknown>).image
    ),
    tracks,
    curator: (playlist as Record<string, unknown>).curator
      ? String((playlist as Record<string, unknown>).curator)
      : undefined,
  };
}

/**
 * 解析单个曲目数据
 */
function parseTrackItem(item: Record<string, unknown>): AppleMusicTrack | null {
  try {
    const name = String(item.name || item.title || "");
    if (!name) return null;

    const artist = extractArtist(item);
    if (!artist) return null;

    return {
      id: String(item.id || item.trackId || `${name}-${artist}`),
      name,
      artist,
      album: String(item.album || item.collection || item.albumName || ""),
      artworkUrl: extractArtworkUrl(item.artwork || item.image || item.cover),
    };
  } catch {
    return null;
  }
}

/**
 * 提取艺术家名称
 */
function extractArtist(item: Record<string, unknown>): string {
  if (item.artist) {
    if (typeof item.artist === "string") return item.artist;
    if (typeof item.artist === "object" && item.artist !== null) {
      return String((item.artist as Record<string, unknown>).name || "");
    }
  }

  if (item.byArtist) {
    if (typeof item.byArtist === "string") return item.byArtist;
    if (typeof item.byArtist === "object" && item.byArtist !== null) {
      return String((item.byArtist as Record<string, unknown>).name || "");
    }
  }

  if (Array.isArray(item.artists) && item.artists.length > 0) {
    const first = item.artists[0];
    if (typeof first === "string") return first;
    if (typeof first === "object" && first !== null) {
      return String((first as Record<string, unknown>).name || "");
    }
  }

  return String(item.artistName || item.singer || "未知艺术家");
}

/**
 * 提取封面 URL
 */
function extractArtworkUrl(imageData: unknown): string | undefined {
  if (!imageData) return undefined;

  if (typeof imageData === "string") return imageData;

  if (typeof imageData === "object" && imageData !== null) {
    const img = imageData as Record<string, unknown>;
    return String(img.url || img.src || img.href || img.contentUrl || "");
  }

  return undefined;
}

/**
 * 将 Apple Music 曲目转换为 MusicTrack
 * source 设为 "apple"，播放时触发自动换源
 *
 * @param track Apple Music 曲目
 * @returns MusicTrack
 */
export function convertToMusicTrack(track: AppleMusicTrack): MusicTrack {
  return {
    id: `apple_${track.id}`,
    name: track.name,
    artist: [track.artist],
    album: track.album,
    pic_id: track.artworkUrl || "",
    url_id: track.id,
    lyric_id: track.id,
    source: "apple",
    update_time: Date.now(),
    is_deleted: false,
  };
}

/**
 * 导入 Apple Music 歌单到本地
 *
 * @param playlist Apple Music 歌单
 * @returns 创建的本地歌单 ID
 */
export function importAppleMusicPlaylist(playlist: AppleMusicPlaylist): string {
  logger.info("apple-music", "Importing playlist", {
    name: playlist.name,
    trackCount: playlist.tracks.length,
  });

  const { createPlaylist, setPlaylistTracks } = useMusicStore.getState();

  // 创建歌单
  const playlistId = createPlaylist(playlist.name, playlist.artworkUrl);

  // 转换并添加曲目
  const tracks = playlist.tracks.map(convertToMusicTrack);
  setPlaylistTracks(playlistId, tracks);

  logger.info("apple-music", "Playlist imported successfully", {
    playlistId,
    trackCount: tracks.length,
  });

  return playlistId;
}

/**
 * 完整的导入流程：URL -> 本地歌单
 *
 * @param url Apple Music 分享链接
 * @returns 创建的本地歌单 ID
 */
export async function importFromUrl(url: string): Promise<string> {
  const playlistId = parsePlaylistId(url);
  if (!playlistId) {
    throw new Error("无法解析歌单链接，请检查链接格式");
  }

  const playlist = await fetchPlaylist(url);
  if (playlist.tracks.length === 0) {
    throw new Error("歌单中没有曲目");
  }

  return importAppleMusicPlaylist(playlist);
}
