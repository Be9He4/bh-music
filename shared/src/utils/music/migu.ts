import type { MusicTrack } from "../../types/music";
import { forceHttps, normalizeResourceUrl } from "../url";
import type {
  MiguPlaylistDetail,
  MiguPlaylistInfoResponse,
  MiguPlaylistSongsResponse,
  MiguSearchSongRaw,
  MiguSongRaw,
  MiguSongUrlResponse,
} from "../../types/music-platforms";

// ============================================================
// 常量
// ============================================================

export const MIGU_PAGE_SIZE = 50;

// ============================================================
// URL / 路径构建
// ============================================================

export function buildMiguPlaylistInfoPath(playlistId: string): string {
  return `/MIGUM2.0/v1.0/content/resourceinfo.do?needSimple=00&resourceType=2021&resourceId=${encodeURIComponent(playlistId)}`;
}

export function buildMiguPlaylistSongsPath(
  playlistId: string,
  page: number,
  pageSize = MIGU_PAGE_SIZE
): string {
  return `/MIGUM2.0/v1.0/user/queryMusicListSongs.do?musicListId=${encodeURIComponent(playlistId)}&pageNo=${page}&pageSize=${pageSize}`;
}

export function buildMiguSongUrlPath(
  copyrightId: string,
  contentId: string,
  br = 192
): string {
  const toneFlag = br >= 999 ? "SQ" : br >= 320 ? "HQ" : "PQ";
  return `/MIGUM3.0/strategy/pc/listen/v1.0?scene=&netType=01&resourceType=2&copyrightId=${encodeURIComponent(copyrightId)}&contentId=${encodeURIComponent(contentId)}&toneFlag=${toneFlag}`;
}

// ============================================================
// 请求头
// ============================================================

export function buildMiguHeaders(): Record<string, string> {
  return {
    channel: "0146951",
    uid: "1234",
  };
}

// ============================================================
// 解析
// ============================================================

export function parseMiguPlaylistInfoResponse(
  text: string
): MiguPlaylistInfoResponse {
  return JSON.parse(text) as MiguPlaylistInfoResponse;
}

export function parseMiguPlaylistSongsResponse(
  text: string
): MiguPlaylistSongsResponse {
  return JSON.parse(text) as MiguPlaylistSongsResponse;
}

export function parseMiguSongUrlResponse(
  response: MiguSongUrlResponse
): string | null {
  const url = response.data?.url || response.data?.playUrl || null;
  return url ? normalizeResourceUrl(url).replace(/\+/g, "%2B") : null;
}

export function parseMiguTrackId(
  trackId: string
): { copyrightId: string; contentId: string } | null {
  const match = trackId.match(/^migu_([^_]+)_([^_]+)$/);
  return match ? { copyrightId: match[1], contentId: match[2] } : null;
}

// ============================================================
// 歌曲转换
// ============================================================

function normalizeArtists(song: MiguSongRaw): string[] {
  const artists = song.artists?.map((artist) => artist.name).filter(Boolean) as
    | string[]
    | undefined;
  if (artists?.length) return artists;
  return (song.singer || "未知歌手")
    .split(/[|、/&]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function convertMiguSongToMusicTrack(song: MiguSongRaw): MusicTrack {
  const copyrightId = song.copyrightId || song.songId || "unknown";
  const contentId = song.contentId || "";
  const encodedId = contentId
    ? `migu_${copyrightId}_${contentId}`
    : `migu_${copyrightId}`;
  const coverUrl = song.albumImgs?.find((item) => item.img)?.img || "";

  return {
    id: encodedId,
    name: song.songName || "未知歌曲",
    artist: normalizeArtists(song),
    album: song.album || "",
    pic_id: coverUrl,
    url_id: encodedId,
    lyric_id: forceHttps(song.lrcUrl || ""),
    source: "migu",
    artist_ids: song.artists?.map((artist) => artist.id).filter(Boolean) as
      | string[]
      | undefined,
    album_id: song.albumId,
  };
}

// ============================================================
// I/O 抽象：分页拉取
// ============================================================

export async function fetchMiguPlaylistDetail(
  playlistId: string,
  fetchText: (path: string) => Promise<string>
): Promise<MiguPlaylistDetail> {
  const infoResponse = parseMiguPlaylistInfoResponse(
    await fetchText(buildMiguPlaylistInfoPath(playlistId))
  );
  if (infoResponse.code !== "000000") {
    throw new Error(infoResponse.info || "咪咕歌单信息接口返回异常");
  }

  const info = infoResponse.resource?.[0];
  const total = info?.musicNum || 0;
  const songs: MiguSongRaw[] = [];
  const pageCount = Math.max(1, Math.ceil(total / MIGU_PAGE_SIZE));

  for (let page = 1; page <= pageCount && page <= 100; page += 1) {
    const songsResponse = parseMiguPlaylistSongsResponse(
      await fetchText(buildMiguPlaylistSongsPath(playlistId, page))
    );
    if (songsResponse.code !== "000000") {
      throw new Error(songsResponse.info || "咪咕歌单歌曲接口返回异常");
    }
    const pageSongs = songsResponse.list || [];
    if (!pageSongs.length) break;
    songs.push(...pageSongs);
    if ((songsResponse.totalCount || total) <= songs.length) break;
  }

  if (!songs.length) throw new Error("歌单为空，无法导入");

  return {
    name: info?.title || `咪咕歌单 ${playlistId}`,
    coverUrl:
      info?.imgItem?.img ||
      songs.find((song) => song.albumImgs?.length)?.albumImgs?.[0]?.img ||
      "",
    trackCount: total || songs.length,
    songs,
  };
}

// ============================================================
// 搜索
// ============================================================

export function buildMiguSearchPath(
  keyword: string,
  page: number,
  rows = 20
): string {
  const params = new URLSearchParams({
    text: keyword,
    pageNo: String(page),
    pageSize: String(rows),
    searchSwitch: '{"song":1}',
  });
  return `/MIGUM2.0/v1.0/content/search_all.do?${params.toString()}`;
}

export function convertMiguSearchSongToMusicTrack(
  song: MiguSearchSongRaw
): MusicTrack {
  const copyrightId = song.copyrightId || "unknown";
  const contentId = song.contentId || "";
  const encodedId = contentId
    ? `migu_${copyrightId}_${contentId}`
    : `migu_${copyrightId}`;

  return {
    id: encodedId,
    name: song.name || "未知歌曲",
    artist: (song.singers || []).map((s) => s.name || "").filter(Boolean),
    album: song.albums?.[0]?.name || "",
    pic_id: forceHttps(song.imgItems?.[0]?.img || ""),
    url_id: encodedId,
    lyric_id: forceHttps(song.lyricUrl || ""),
    source: "migu",
    artist_ids: (song.singers || []).map((s) => s.id || "").filter(Boolean),
    album_id: song.albums?.[0]?.id,
  };
}
