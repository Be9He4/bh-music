import type { MusicTrack, SongLyric } from '@/types/music';
import { fetchWithTimeout, getApiUrl, getProxyUrl, IS_NATIVE, IS_WEB_PROD } from '@/lib/api/config';
import type {
  MiguPlaylistDetail,
  MiguPlaylistInfoResponse,
  MiguPlaylistSongsResponse,
  MiguSongRaw,
  MiguSongUrlResponse,
} from './migu-types';
import { forceHttps } from '../music-provider';

const MIGU_PROXY_PREFIX = '/music-api/migu';
const MIGU_PAGE_SIZE = 50;
const NETWORK_TIMEOUT = 12000;

/**
 * 从咪咕歌单分享链接中提取歌单 ID。
 */
export function parseMiguPlaylistUrl(urlStr: string): string | null {
  try {
    const normalized = urlStr.replace('music.migu.cn/v3/my/playlist/', 'music.migu.cn/v3/music/playlist/');
    const url = new URL(normalized.startsWith('http') ? normalized : `https://${normalized}`);
    const pathMatch = url.pathname.match(/\/v3\/music\/playlist\/(\d+)/);
    if (pathMatch) return pathMatch[1];

    const idParam = url.searchParams.get('playlistId') || url.searchParams.get('musicListId') || url.searchParams.get('id');
    return idParam && /^\d+$/.test(idParam) ? idParam : null;
  } catch {
    return null;
  }
}

/**
 * 解析咪咕标准歌单链接或分享短链对应的歌单 ID。
 */
export async function resolveMiguPlaylistId(urlStr: string): Promise<string | null> {
  const directId = parseMiguPlaylistUrl(urlStr);
  if (directId) return directId;

  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'https:' || url.hostname !== 'c.migu.cn') return null;

    const endpoint = (!IS_WEB_PROD && !IS_NATIVE)
      ? '/api/migu-resolve'
      : `${getApiUrl()}${MIGU_PROXY_PREFIX}/resolve-playlist`;

    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.toString() }),
    }, NETWORK_TIMEOUT);
    if (!res.ok) return null;

    const data = await res.json() as { playlistId?: string };
    return data.playlistId && /^\d+$/.test(data.playlistId) ? data.playlistId : null;
  } catch {
    return null;
  }
}

/**
 * 构建咪咕歌单信息接口路径。
 */
export function buildMiguPlaylistInfoPath(playlistId: string): string {
  return `/MIGUM2.0/v1.0/content/resourceinfo.do?needSimple=00&resourceType=2021&resourceId=${encodeURIComponent(playlistId)}`;
}

/**
 * 构建咪咕歌单歌曲分页接口路径。
 */
export function buildMiguPlaylistSongsPath(playlistId: string, page: number, pageSize = MIGU_PAGE_SIZE): string {
  return `/MIGUM2.0/v1.0/user/queryMusicListSongs.do?musicListId=${encodeURIComponent(playlistId)}&pageNo=${page}&pageSize=${pageSize}`;
}

/**
 * 构建咪咕播放地址接口路径。
 */
export function buildMiguSongUrlPath(copyrightId: string, contentId: string, br = 192): string {
  const toneFlag = br >= 999 ? 'SQ' : br >= 320 ? 'HQ' : 'PQ';
  return `/MIGUM3.0/strategy/pc/listen/v1.0?scene=&netType=01&resourceType=2&copyrightId=${encodeURIComponent(copyrightId)}&contentId=${encodeURIComponent(contentId)}&toneFlag=${toneFlag}`;
}

/**
 * 将咪咕歌曲对象转换为应用内部 MusicTrack。
 */
export function convertMiguSongToMusicTrack(song: MiguSongRaw): MusicTrack {
  const copyrightId = song.copyrightId || song.songId || 'unknown';
  const contentId = song.contentId || '';
  const encodedId = contentId ? `migu_${copyrightId}_${contentId}` : `migu_${copyrightId}`;
  const coverUrl = song.albumImgs?.find((item) => item.img)?.img || '';

  return {
    id: encodedId,
    name: song.songName || '未知歌曲',
    artist: normalizeArtists(song),
    album: song.album || '',
    pic_id: coverUrl,
    url_id: encodedId,
    lyric_id: forceHttps(song.lrcUrl || ''),
    source: 'migu',
    artist_ids: song.artists?.map((artist) => artist.id).filter(Boolean) as string[] | undefined,
    album_id: song.albumId,
  };
}

/**
 * 获取咪咕公开歌单详情。
 */
export async function getMiguPlaylistDetail(playlistId: string): Promise<MiguPlaylistDetail> {
  if (IS_WEB_PROD) {
    const res = await fetchWithTimeout(`${getApiUrl()}${MIGU_PROXY_PREFIX}/playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistId }),
    }, NETWORK_TIMEOUT);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `API error: ${res.status}`);
    }
    return res.json();
  }

  if (IS_NATIVE) {
    const { CapacitorHttp } = await import('@capacitor/core');
    return fetchMiguPlaylistDetail(playlistId, async (path) => {
      const res = await CapacitorHttp.request({
        method: 'GET',
        url: `https://app.c.nf.migu.cn${path}`,
      });
      if (res.status >= 400) throw new Error(`Migu API error: ${res.status}`);
      return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    });
  }

  return fetchMiguPlaylistDetail(playlistId, async (path) => {
    const res = await fetchWithTimeout(`/api/migu${path}`, {}, NETWORK_TIMEOUT);
    if (!res.ok) throw new Error(`Migu API error: ${res.status}`);
    return res.text();
  });
}

/**
 * 拉取并解析咪咕歌单详情。
 */
export async function fetchMiguPlaylistDetail(
  playlistId: string,
  fetchText: (path: string) => Promise<string>,
): Promise<MiguPlaylistDetail> {
  const infoResponse = parseMiguPlaylistInfoResponse(await fetchText(buildMiguPlaylistInfoPath(playlistId)));
  if (infoResponse.code !== '000000') {
    throw new Error(infoResponse.info || '咪咕歌单信息接口返回异常');
  }

  const info = infoResponse.resource?.[0];
  const total = info?.musicNum || 0;
  const songs: MiguSongRaw[] = [];
  const pageCount = Math.max(1, Math.ceil(total / MIGU_PAGE_SIZE));

  for (let page = 1; page <= pageCount && page <= 100; page += 1) {
    const songsResponse = parseMiguPlaylistSongsResponse(await fetchText(buildMiguPlaylistSongsPath(playlistId, page)));
    if (songsResponse.code !== '000000') {
      throw new Error(songsResponse.info || '咪咕歌单歌曲接口返回异常');
    }
    const pageSongs = songsResponse.list || [];
    if (!pageSongs.length) break;
    songs.push(...pageSongs);
    if ((songsResponse.totalCount || total) <= songs.length) break;
  }

  if (!songs.length) throw new Error('歌单为空，无法导入');

  return {
    name: info?.title || `咪咕歌单 ${playlistId}`,
    coverUrl: info?.imgItem?.img || songs.find((song) => song.albumImgs?.length)?.albumImgs?.[0]?.img || '',
    trackCount: total || songs.length,
    songs,
  };
}

/**
 * 获取咪咕歌曲播放地址。
 */
export async function getMiguSongUrl(trackId: string, br = 192): Promise<string | null> {
  const ids = parseMiguTrackId(trackId);
  if (!ids) return null;

  if (IS_WEB_PROD) {
    const res = await fetchWithTimeout(`${getApiUrl()}${MIGU_PROXY_PREFIX}/song-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copyrightId: ids.copyrightId, contentId: ids.contentId, br }),
    }, NETWORK_TIMEOUT);
    if (!res.ok) return null;
    const data = await res.json() as { url?: string | null };
    return data.url || null;
  }

  const path = buildMiguSongUrlPath(ids.copyrightId, ids.contentId, br);
  const fetchJson = async (): Promise<MiguSongUrlResponse> => {
    if (IS_NATIVE) {
      const { CapacitorHttp } = await import('@capacitor/core');
      const res = await CapacitorHttp.request({
        method: 'GET',
        url: `https://app.c.nf.migu.cn${path}`,
        headers: buildMiguHeaders(),
      });
      return typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    }
    const res = await fetchWithTimeout(`/api/migu${path}`, { headers: buildMiguHeaders() }, NETWORK_TIMEOUT);
    if (!res.ok) return {};
    return res.json();
  };

  return parseMiguSongUrlResponse(await fetchJson());
}

/**
 * 获取咪咕歌词。
 */
export async function getMiguLyric(lyricUrl: string): Promise<SongLyric | null> {
  const normalizedUrl = normalizeMiguResourceUrl(lyricUrl);
  if (!normalizedUrl.startsWith('http')) return null;

  try {
    if (IS_NATIVE) {
      const { CapacitorHttp } = await import('@capacitor/core');
      const res = await CapacitorHttp.request({ method: 'GET', url: normalizedUrl });
      if (res.status >= 400) return null;
      return { lyric: typeof res.data === 'string' ? res.data : String(res.data), tlyric: '' };
    }

    const res = await fetchWithTimeout(getProxyUrl(normalizedUrl), {}, NETWORK_TIMEOUT);
    if (!res.ok) return null;
    return { lyric: await res.text(), tlyric: '' };
  } catch {
    return null;
  }
}

/**
 * 解析咪咕歌单信息响应。
 */
export function parseMiguPlaylistInfoResponse(text: string): MiguPlaylistInfoResponse {
  return JSON.parse(text) as MiguPlaylistInfoResponse;
}

/**
 * 解析咪咕歌单歌曲响应。
 */
export function parseMiguPlaylistSongsResponse(text: string): MiguPlaylistSongsResponse {
  return JSON.parse(text) as MiguPlaylistSongsResponse;
}

/**
 * 解析咪咕歌曲播放地址响应。
 */
export function parseMiguSongUrlResponse(response: MiguSongUrlResponse): string | null {
  const url = response.data?.url || response.data?.playUrl || null;
  return url ? normalizeMiguResourceUrl(url).replace(/\+/g, '%2B') : null;
}

/**
 * 从内部曲目 ID 中拆出咪咕版权 ID 和内容 ID。
 */
export function parseMiguTrackId(trackId: string): { copyrightId: string; contentId: string } | null {
  const match = trackId.match(/^migu_([^_]+)_([^_]+)$/);
  return match ? { copyrightId: match[1], contentId: match[2] } : null;
}

/**
 * 生成咪咕接口需要的固定请求头。
 */
export function buildMiguHeaders(): Record<string, string> {
  return {
    channel: '0146951',
    uid: '1234',
  };
}

/**
 * 将咪咕接口返回的资源地址规范为 HTTPS 绝对地址。
 */
function normalizeMiguResourceUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  return forceHttps(url);
}

/**
 * 从咪咕歌曲字段中得到规范化歌手列表。
 */
function normalizeArtists(song: MiguSongRaw): string[] {
  const artists = song.artists?.map((artist) => artist.name).filter(Boolean) as string[] | undefined;
  if (artists?.length) return artists;
  return (song.singer || '未知歌手').split(/[|、/&]/).map((name) => name.trim()).filter(Boolean);
}
