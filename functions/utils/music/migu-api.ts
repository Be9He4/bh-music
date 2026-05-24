interface MiguPlaylistInfoResponse {
  code?: string;
  info?: string;
  resource?: MiguPlaylistInfoRaw[];
}

interface MiguPlaylistInfoRaw {
  title?: string;
  musicNum?: number;
  imgItem?: {
    img?: string;
  };
}

interface MiguPlaylistSongsResponse {
  code?: string;
  info?: string;
  totalCount?: number;
  list?: MiguSongRaw[];
}

interface MiguSongRaw {
  copyrightId?: string;
  contentId?: string;
  songId?: string;
  songName?: string;
  singer?: string;
  album?: string;
  albumId?: string;
  albumImgs?: Array<{ img?: string; imgSizeType?: string }>;
  artists?: Array<{ id?: string; name?: string }>;
  lrcUrl?: string;
}

interface MiguSongUrlResponse {
  code?: string;
  info?: string;
  data?: {
    url?: string;
    playUrl?: string;
  };
}

export interface MiguPlaylistDetail {
  name: string;
  coverUrl: string;
  trackCount: number;
  songs: MiguSongRaw[];
}

const MIGU_BASE_URL = 'https://app.c.nf.migu.cn';
const MIGU_PAGE_SIZE = 50;
const MIGU_SHORT_LINK_HOST = 'c.migu.cn';
const MIGU_SHARE_PAGE_HOST = 'h5.nf.migu.cn';
const MIGU_SHARE_PLAYLIST_PATH = '/app/v4/p/share/playlist/index.html';

/**
 * 判断 URL 是否为允许解析的咪咕分享短链。
 */
export function isMiguPlaylistShortLink(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    return url.protocol === 'https:' && url.hostname === MIGU_SHORT_LINK_HOST;
  } catch {
    return false;
  }
}

/**
 * 从咪咕歌单分享跳转目标中提取歌单 ID。
 */
export function parseMiguShareRedirectPlaylistId(urlStr: string): string | null {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'https:' || url.hostname !== MIGU_SHARE_PAGE_HOST || url.pathname !== MIGU_SHARE_PLAYLIST_PATH) {
      return null;
    }
    const playlistId = url.searchParams.get('id');
    return playlistId && /^\d+$/.test(playlistId) ? playlistId : null;
  } catch {
    return null;
  }
}

/**
 * 请求咪咕分享短链并解析重定向中的歌单 ID。
 */
export async function resolveMiguShortPlaylistId(
  urlStr: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  if (!isMiguPlaylistShortLink(urlStr)) return null;

  const response = await fetcher(urlStr, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  const redirectUrl = response.headers.get('Location') || response.url;
  return parseMiguShareRedirectPlaylistId(redirectUrl);
}

/**
 * 构建咪咕歌单信息接口路径。
 */
function buildMiguPlaylistInfoPath(playlistId: string): string {
  return `/MIGUM2.0/v1.0/content/resourceinfo.do?needSimple=00&resourceType=2021&resourceId=${encodeURIComponent(playlistId)}`;
}

/**
 * 构建咪咕歌单歌曲分页接口路径。
 */
function buildMiguPlaylistSongsPath(playlistId: string, page: number, pageSize = MIGU_PAGE_SIZE): string {
  return `/MIGUM2.0/v1.0/user/queryMusicListSongs.do?musicListId=${encodeURIComponent(playlistId)}&pageNo=${page}&pageSize=${pageSize}`;
}

/**
 * 构建咪咕播放地址接口路径。
 */
function buildMiguSongUrlPath(copyrightId: string, contentId: string, br = 192): string {
  const toneFlag = br >= 999 ? 'SQ' : br >= 320 ? 'HQ' : 'PQ';
  return `/MIGUM3.0/strategy/pc/listen/v1.0?scene=&netType=01&resourceType=2&copyrightId=${encodeURIComponent(copyrightId)}&contentId=${encodeURIComponent(contentId)}&toneFlag=${toneFlag}`;
}

/**
 * 获取咪咕公开歌单详情。
 */
export async function fetchMiguPlaylistDetail(playlistId: string): Promise<MiguPlaylistDetail> {
  const infoResponse = await fetchMiguJson<MiguPlaylistInfoResponse>(buildMiguPlaylistInfoPath(playlistId));
  if (infoResponse.code !== '000000') {
    throw new Error(infoResponse.info || '咪咕歌单信息接口返回异常');
  }

  const info = infoResponse.resource?.[0];
  const total = info?.musicNum || 0;
  const songs: MiguSongRaw[] = [];
  const pageCount = Math.max(1, Math.ceil(total / MIGU_PAGE_SIZE));

  for (let page = 1; page <= pageCount && page <= 100; page += 1) {
    const songsResponse = await fetchMiguJson<MiguPlaylistSongsResponse>(buildMiguPlaylistSongsPath(playlistId, page));
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
export async function fetchMiguSongUrl(copyrightId: string, contentId: string, br = 192): Promise<string | null> {
  const response = await fetchMiguJson<MiguSongUrlResponse>(buildMiguSongUrlPath(copyrightId, contentId, br), {
    channel: '0146951',
    uid: '1234',
  });
  const url = response.data?.url || response.data?.playUrl || null;
  return url ? url.replace(/\+/g, '%2B') : null;
}

/**
 * 请求咪咕 JSON 接口。
 */
async function fetchMiguJson<T>(path: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(`${MIGU_BASE_URL}${path}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`Migu API error: ${res.status}`);
  return res.json() as Promise<T>;
}
