import type { MusicTrack } from '../../types/music';
import { forceHttps } from '../url';
import type { KuwoPlaylistDetail, KuwoPlaylistResponse, KuwoSongRaw } from '../../types/music-platforms';

// ============================================================
// 常量
// ============================================================

export const KUWO_PAGE_SIZE = 1000;

// ============================================================
// URL 构建
// ============================================================

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

// ============================================================
// 解析
// ============================================================

export function parseKuwoPlaylistResponse(text: string): KuwoPlaylistResponse {
  return JSON.parse(text) as KuwoPlaylistResponse;
}

// ============================================================
// 歌曲转换
// ============================================================

function splitArtists(artist?: string): string[] {
  return (artist || '未知歌手')
    .split(/[、/&]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function convertKuwoSongToMusicTrack(song: KuwoSongRaw): MusicTrack {
  const rawId = song.rid || song.id || song.musicrid?.replace(/^MUSIC_/, '') || song.name || 'unknown';
  const coverUrl = forceHttps(song.albumpic || song.pic || '');

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

// ============================================================
// I/O 抽象：分页拉取
// ============================================================

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
    coverUrl: forceHttps(response.pic || songs.find((song) => song.albumpic)?.albumpic || ''),
    trackCount: total || songs.length,
    songs,
  };
}
