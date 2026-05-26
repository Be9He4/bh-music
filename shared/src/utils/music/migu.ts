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
// 搜索（jadeite.migu.cn V2 + Android 应用签名）
// ============================================================

const SIGNATURE_MD5 = "6cdc72a439cef99a3418d2a78aa28c73";
const APP_ID = "yyapp2";
const APP_SECRET = "yyapp2d16148780a1dcc7408e06336b98cfd50";

/** 同步 MD5 哈希（hex 输出） */
function md5Hex(input: string): string {
  const add = (a: number, b: number) => (a + b) & 0xffffffff;
  const cmn = (
    q: number,
    a: number,
    b: number,
    x: number,
    s: number,
    t: number
  ): number =>
    (add((q + a + x + t) >>> 0, 0) << (s + (q >>> 31) * 32)) |
    (((q + a + x + t) << s) >>> (32 - s + b));

  const bytes: number[] = [];
  for (let i = 0; i < input.length; i += 1) {
    bytes.push(input.charCodeAt(i) & 0xff);
  }
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const lo = input.length * 8;
  for (let i = 0; i < 8; i += 1) bytes.push((lo >>> (i * 8)) & 0xff);

  let a = 0x67452301,
    b = 0xefcdab89,
    c = 0x98badcfe,
    d = 0x10325476;
  for (let i = 0; i < bytes.length; i += 64) {
    const w = new Array(16);
    for (let j = 0; j < 16; j += 1)
      w[j] =
        bytes[i + j * 4] |
        (bytes[i + j * 4 + 1] << 8) |
        (bytes[i + j * 4 + 2] << 16) |
        (bytes[i + j * 4 + 3] << 24);
    let aa = a,
      bb = b,
      cc = c,
      dd = d;
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].forEach((j) => {
      a = cmn((b & c) | (~b & d), a, b, w[j], 7, 0xd76aa478);
      d = cmn((a & b) | (~a & c), d, a, w[(j + 1) % 16], 12, 0xe8c7b756);
      c = cmn((d & a) | (~d & b), c, d, w[(j + 2) % 16], 17, 0x242070db);
      b = cmn((c & d) | (~c & a), b, c, w[(j + 3) % 16], 22, 0xc1bdceee);
    });
    [1, 6, 11, 0, 5, 10, 15, 4, 9, 14, 3, 8, 13, 2, 7, 12].forEach((j) => {
      a = cmn((b & d) | (c & ~d), a, b, w[j], 5, 0xf61e2562);
      d = cmn((a & c) | (b & ~c), d, a, w[(j + 5) % 16], 9, 0xc040b340);
      c = cmn((d & b) | (a & ~b), c, d, w[(j + 10) % 16], 14, 0x265e5a51);
      b = cmn((c & a) | (d & ~a), b, c, w[(j + 15) % 16], 20, 0xe9b6c7aa);
    });
    [5, 8, 11, 14, 1, 4, 7, 10, 13, 0, 3, 6, 9, 12, 15, 2].forEach((j) => {
      a = cmn(b ^ c ^ d, a, b, w[j], 4, 0xd62f105d);
      d = cmn(a ^ b ^ c, d, a, w[(j + 3) % 16], 11, 0x02441453);
      c = cmn(d ^ a ^ b, c, d, w[(j + 6) % 16], 16, 0xd8a1e681);
      b = cmn(c ^ d ^ a, b, c, w[(j + 9) % 16], 23, 0xe7d3fbc8);
    });
    a = add(a, aa);
    b = add(b, bb);
    c = add(c, cc);
    d = add(d, dd);
  }
  return [a, b, c, d]
    .map((v) => ((v >>> 0) + 0x100000000).toString(16).slice(-8))
    .join("");
}

function uuidHex(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function generateMiguSid(): string {
  return uuidHex();
}

let _deviceId: string | null = null;
export function generateMiguDeviceId(): string {
  if (!_deviceId) _deviceId = uuidHex().toUpperCase();
  return _deviceId;
}

export function generateMiguSign(
  keyword: string,
  deviceId: string,
  timestamp: number
): string {
  return md5Hex(
    `${keyword}${SIGNATURE_MD5}${APP_SECRET}${deviceId}${timestamp}`
  );
}

export function buildMiguSearchHeaders(
  keyword: string
): Record<string, string> {
  const deviceId = generateMiguDeviceId();
  const timestamp = Date.now();
  return {
    appid: APP_ID,
    deviceid: deviceId,
    sign: generateMiguSign(keyword, deviceId, timestamp),
    timestamp: String(timestamp),
    uiversion: "A_music_3.3.0",
    version: "7.0.4",
    os: "android",
    platform: "android",
    channel: "0146951",
  };
}

export function buildMiguSearchPath(
  keyword: string,
  page: number,
  rows = 20,
  sid: string
): string {
  const params = new URLSearchParams({
    sid,
    text: keyword,
    pageNo: String(page),
    pageSize: String(rows),
    isCorrect: "1",
    isCopyright: "1",
    searchSwitch: '{"song":1}',
    sort: "1",
    feature: "1000000000",
  });
  return `/music_search/v2/search/searchAll?${params.toString()}`;
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
