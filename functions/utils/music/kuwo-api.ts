interface KuwoPlaylistResponse {
  result?: string;
  msg?: string;
  title?: string;
  pic?: string;
  total?: number;
  musiclist?: KuwoSongRaw[];
}

interface KuwoSongRaw {
  id?: string | number;
  rid?: string | number;
  musicrid?: string;
  name?: string;
  songname?: string;
  artist?: string;
  album?: string;
  albumid?: string | number;
  albumpic?: string;
  pic?: string;
}

export interface KuwoPlaylistDetail {
  name: string;
  coverUrl: string;
  trackCount: number;
  songs: KuwoSongRaw[];
}

const KUWO_BASE_URL = 'http://nplserver.kuwo.cn';
const KUWO_PAGE_SIZE = 1000;

/**
 * 构建酷我公开歌单详情接口路径。
 */
function buildKuwoPlaylistApiPath(playlistId: string, page = 0, pageSize = KUWO_PAGE_SIZE): string {
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
 * 获取酷我公开歌单详情。
 */
export async function fetchKuwoPlaylistDetail(playlistId: string): Promise<KuwoPlaylistDetail> {
  const response = await fetchKuwoPlaylistPage(playlistId, 0);
  if (response.result !== 'ok') {
    throw new Error(response.msg || '酷我歌单接口返回异常');
  }

  const songs = [...(response.musiclist || [])];
  const total = response.total || songs.length;
  for (let page = 1; total > songs.length && page < 100; page += 1) {
    const pageResponse = await fetchKuwoPlaylistPage(playlistId, page);
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
    coverUrl: response.pic || songs.find((song) => song.albumpic)?.albumpic || '',
    trackCount: total || songs.length,
    songs,
  };
}

/**
 * 获取酷我歌单单页数据。
 */
async function fetchKuwoPlaylistPage(playlistId: string, page: number): Promise<KuwoPlaylistResponse> {
  const res = await fetch(`${KUWO_BASE_URL}${buildKuwoPlaylistApiPath(playlistId, page)}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`Kuwo API error: ${res.status}`);
  return (await res.json()) as KuwoPlaylistResponse;
}
