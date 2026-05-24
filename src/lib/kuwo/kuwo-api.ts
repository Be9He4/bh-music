import type { MusicTrack } from '@/types/music';
import { fetchWithTimeout, getApiUrl, IS_NATIVE, IS_WEB_PROD } from '@/lib/api/config';
import type { KuwoPlaylistDetail, KuwoPlaylistResponse, KuwoSongRaw } from './kuwo-types';

const KUWO_PROXY_PREFIX = '/music-api/kuwo';
const KUWO_PAGE_SIZE = 1000;
const NETWORK_TIMEOUT = 12000;

/**
 * 从酷我歌单分享链接中提取歌单 ID。
 */
export function parseKuwoPlaylistUrl(urlStr: string): string | null {
  try {
    const url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    const pathMatch = url.pathname.match(/playlist_detail\/(\d+)/);
    if (pathMatch) return pathMatch[1];

    const idParam = url.searchParams.get('pid') || url.searchParams.get('id');
    return idParam && /^\d+$/.test(idParam) ? idParam : null;
  } catch {
    return null;
  }
}

/**
 * 构建酷我公开歌单详情接口路径。
 */
export function buildKuwoPlaylistApiPath(playlistId: string, page = 0, pageSize = KUWO_PAGE_SIZE): string {
  const params = new URLSearchParams({
    op: 'getlistinfo',
    pid: playlistId,
    pn: String(page),
    rn: String(pageSize),
    encode: 'utf-8',
    keyset: 'pl2012',
    identity: 'kuwo',
    vipver: 'MUSIC_9.1.1.2_BCS2',
    newver: '1',
  });
  return `/pl.svc?${params.toString()}`;
}

/**
 * 将酷我歌曲对象转换为应用内部 MusicTrack。
 */
export function convertKuwoSongToMusicTrack(song: KuwoSongRaw): MusicTrack {
  const rawId = song.rid || song.id || song.musicrid?.replace(/^MUSIC_/, '') || song.name || 'unknown';
  const coverUrl = song.albumpic || song.pic || '';

  return {
    id: `kuwo_${rawId}`,
    name: song.name || song.songname || '未知歌曲',
    artist: splitArtists(song.artist),
    album: song.album || '',
    pic_id: coverUrl,
    url_id: String(rawId),
    lyric_id: String(rawId),
    source: 'kuwo',
    album_id: song.albumid ? String(song.albumid) : undefined,
  };
}

/**
 * 获取酷我公开歌单详情。
 */
export async function getKuwoPlaylistDetail(playlistId: string): Promise<KuwoPlaylistDetail> {
  if (IS_WEB_PROD) {
    const res = await fetchWithTimeout(`${getApiUrl()}${KUWO_PROXY_PREFIX}/playlist`, {
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
    return fetchKuwoPlaylistDetail(playlistId, async (path) => {
      const res = await CapacitorHttp.request({
        method: 'GET',
        url: `http://nplserver.kuwo.cn${path}`,
      });
      if (res.status >= 400) throw new Error(`Kuwo API error: ${res.status}`);
      return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    });
  }

  return fetchKuwoPlaylistDetail(playlistId, async (path) => {
    const res = await fetchWithTimeout(`/api/kuwo${path}`, {}, NETWORK_TIMEOUT);
    if (!res.ok) throw new Error(`Kuwo API error: ${res.status}`);
    return res.text();
  });
}

/**
 * 拉取并解析酷我歌单详情。
 */
export async function fetchKuwoPlaylistDetail(
  playlistId: string,
  fetchText: (path: string) => Promise<string>,
): Promise<KuwoPlaylistDetail> {
  const response = parseKuwoPlaylistResponse(await fetchText(buildKuwoPlaylistApiPath(playlistId, 0)));
  if (response.result !== 'ok') {
    throw new Error(response.msg || '酷我歌单接口返回异常');
  }

  const songs = [...(response.musiclist || [])];
  const total = response.total || songs.length;
  for (let page = 1; total > songs.length && page < 100; page += 1) {
    const pageResponse = parseKuwoPlaylistResponse(await fetchText(buildKuwoPlaylistApiPath(playlistId, page)));
    if (pageResponse.result !== 'ok') {
      throw new Error(pageResponse.msg || '酷我歌单接口返回异常');
    }
    const pageSongs = pageResponse.musiclist || [];
    if (!pageSongs.length) break;
    songs.push(...pageSongs);
  }

  if (!songs.length) throw new Error('歌单为空，无法导入');

  return {
    name: response.title || `酷我歌单 ${playlistId}`,
    coverUrl: response.pic || songs.find((song) => song.albumpic)?.albumpic || '',  // 注意：酷我的图片需为HTTP, https无法正常显示
    trackCount: total || songs.length,
    songs,
  };
}

/**
 * 解析酷我歌单接口 JSON。
 */
export function parseKuwoPlaylistResponse(text: string): KuwoPlaylistResponse {
  return JSON.parse(text) as KuwoPlaylistResponse;
}

/**
 * 拆分酷我歌手字段。
 */
function splitArtists(artist?: string): string[] {
  return (artist || '未知歌手')
    .split(/[、/&]/)
    .map((name) => name.trim())
    .filter(Boolean);
}
