import type { MusicTrack, SearchPageResult, SongLyric } from "@/types/music";
import {
  QQ_BASE_URL,
  type QqPlaylistDetail,
  type QqPlaylistResponse,
  type QqSongRaw,
} from "./qqmusic-types";
import { IS_NATIVE, IS_WEB_PROD, getApiUrl } from "@/lib/api/config";

const QQ_PROXY_PREFIX = "/music-api/qqmusic";
const NETWORK_TIMEOUT = 12000;
const QQ_REFERER = "https://y.qq.com/";

/**
 * 从 QQ 音乐分享链接中提取歌单数字 ID。
 * 支持格式:
 *   https://y.qq.com/n/yqq/playlist/{id}.html
 *   https://i.y.qq.com/n2/m/share/details/taoge.html?id={id}
 */
export function parseQqMusicUrl(urlStr: string): string | null {
  try {
    const url = new URL(
      urlStr.startsWith("http") ? urlStr : `https://${urlStr}`
    );

    // 尝试从路径中提取: /n/yqq/playlist/7177076625.html
    const playlistMatch = url.pathname.match(/playlist\/(\d+)/);
    if (playlistMatch) return playlistMatch[1];

    // 尝试从 query 参数中提取: ?id=7177076625
    const idParam = url.searchParams.get("id");
    if (idParam && /^\d+$/.test(idParam)) return idParam;

    return null;
  } catch {
    return null;
  }
}

/**
 * 将 QQ 音乐歌曲对象转换为应用内部的 MusicTrack 格式。
 */
export function convertQqSongToMusicTrack(song: QqSongRaw): MusicTrack {
  const picUrl = song.albummid
    ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${song.albummid}.jpg`
    : "";

  return {
    id: `qq_${song.songmid}`,
    name: song.songname,
    artist: song.singer.map((s) => s.name),
    album: song.albumname,
    pic_id: picUrl,
    url_id: song.songmid,
    lyric_id: song.songmid,
    source: "qq",
  };
}

/**
 * 构建 QQ 音乐歌单 API 请求路径（不含域名/代理前缀）。
 * 抽离为纯函数以便测试。
 */
export function buildQqPlaylistApiPath(playlistId: string): string {
  return `/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&nosign=1&disstid=${encodeURIComponent(playlistId)}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=GB2312&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = NETWORK_TIMEOUT
) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * 获取 QQ 音乐歌单详情。
 * - 开发环境 (Web): 通过 Vite 代理 /api/qqmusic → i.y.qq.com
 * - 生产环境 (Web): 通过 Cloudflare Worker /music-api/qqmusic/playlist
 * - 原生环境 (Capacitor): 直接调用 i.y.qq.com (原生无 CORS 限制)
 */
export async function getQqPlaylistDetail(
  playlistId: string
): Promise<QqPlaylistDetail> {
  if (IS_WEB_PROD) {
    // 生产环境走 Worker 代理
    const apiUrl = getApiUrl();
    const res = await fetchWithTimeout(`${apiUrl}${QQ_PROXY_PREFIX}/playlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playlistId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error || `API error: ${res.status}`
      );
    }
    return res.json();
  }

  if (IS_NATIVE) {
    // 原生环境直接请求
    const url = `${QQ_BASE_URL}${buildQqPlaylistApiPath(playlistId)}`;
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      method: "GET",
      url,
      headers: { Referer: QQ_REFERER },
    });
    if (res.status >= 400) throw new Error(`QQ Music API error: ${res.status}`);
    const rawText =
      typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    const data = parseQqPlaylistResponse(rawText);
    if (data.subcode && data.subcode !== 0)
      throw new Error(
        data.msg || `QQ Music API returned subcode ${data.subcode}`
      );
    if (!data.cdlist?.length) throw new Error("歌单不存在或已被删除");
    return {
      name: data.cdlist[0].dissname,
      coverUrl: data.cdlist[0].logo,
      trackCount: data.cdlist[0].songnum,
      songs: data.cdlist[0].songlist || [],
    };
  }

  // 开发环境 (Web): 通过 Vite 代理
  // 注意: 不能在 headers 中设置 Referer，浏览器会静默丢弃（forbidden header）。
  // Referer 由 Vite 代理的 configure 钩子在服务端注入。
  const url = `/api/qqmusic${buildQqPlaylistApiPath(playlistId)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`QQ Music API error: ${res.status}`);

  const rawText = await res.text();
  const data = parseQqPlaylistResponse(rawText);

  if (data.subcode && data.subcode !== 0)
    throw new Error(
      data.msg || `QQ Music API returned subcode ${data.subcode}`
    );
  if (!data.cdlist?.length) throw new Error("歌单不存在或已被删除");

  return {
    name: data.cdlist[0].dissname,
    coverUrl: data.cdlist[0].logo,
    trackCount: data.cdlist[0].songnum,
    songs: data.cdlist[0].songlist || [],
  };
}

/**
 * 解析 QQ 音乐接口响应，优先按纯 JSON 处理，失败后兼容 JSONP 包装。
 */
export function parseQqPlaylistResponse(text: string): QqPlaylistResponse {
  try {
    return JSON.parse(text) as QqPlaylistResponse;
  } catch (jsonError) {
    const jsonpMatch = text.trim().match(/^[\w$.]+\s*\(([\s\S]*)\)\s*;?$/);
    if (!jsonpMatch) throw jsonError;
    return JSON.parse(jsonpMatch[1]) as QqPlaylistResponse;
  }
}

// --- QQ 音乐搜索 ---

const PAGE_SIZE = 20;
const QQ_SEARCH_URL = "https://u.y.qq.com/cgi-bin/musicu.fcg";
const QQ_LYRIC_URL =
  "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg";
const QQ_MEDIA_URL = "https://lxmusicapi.onrender.com/url/tx";

const QQ_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36";

interface QqSearchResponse {
  req_1: {
    code: number;
    data: {
      meta: { sum: number };
      body: { song: { list: QqSearchSongRaw[] } };
    };
  };
}

interface QqSearchSongRaw {
  id?: string;
  mid?: string;
  songid?: string;
  songmid?: string;
  title?: string;
  songname?: string;
  singer: { name: string }[];
  album?: { id?: string; mid?: string; title?: string };
  albumid?: string;
  albummid?: string;
  albumname?: string;
}

function convertQqSearchSongToMusicTrack(song: QqSearchSongRaw): MusicTrack {
  const songmid = song.mid || song.songmid || "";
  const albummid = song.album?.mid || song.albummid || "";
  const picUrl = albummid
    ? `https://y.gtimg.cn/music/photo_new/T002R800x800M000${albummid}.jpg`
    : "";
  return {
    id: `qq_${songmid}`,
    name: song.title || song.songname || "",
    artist: (song.singer || []).map((s) => s.name),
    album: song.album?.title || song.albumname || "",
    pic_id: picUrl,
    url_id: songmid,
    lyric_id: songmid,
    source: "qq",
  };
}

export async function searchQqMusic(
  query: string,
  page: number,
  signal?: AbortSignal
): Promise<SearchPageResult<MusicTrack>> {
  if (IS_WEB_PROD) {
    const apiUrl = getApiUrl();
    const res = await fetchWithTimeout(`${apiUrl}${QQ_PROXY_PREFIX}/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "search", query, page }),
      signal,
    });
    if (!res.ok) return { items: [], hasMore: false };
    return res.json();
  }

  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      method: "POST",
      url: QQ_SEARCH_URL,
      headers: {
        "Content-Type": "application/json",
        Referer: QQ_REFERER,
        "User-Agent": QQ_USER_AGENT,
        Cookie: "uin=",
      },
      data: JSON.stringify({
        req_1: {
          method: "DoSearchForQQMusicDesktop",
          module: "music.search.SearchCgiService",
          param: {
            num_per_page: PAGE_SIZE,
            page_num: page,
            query,
            search_type: 0,
          },
        },
      }),
    });
    if (res.status >= 400) return { items: [], hasMore: false };
    const data =
      typeof res.data === "string"
        ? (JSON.parse(res.data) as QqSearchResponse)
        : (res.data as QqSearchResponse);
    const list = data?.req_1?.data?.body?.song?.list || [];
    const total = data?.req_1?.data?.meta?.sum || 0;
    return {
      items: list.map(convertQqSearchSongToMusicTrack),
      hasMore: page * PAGE_SIZE < total,
    };
  }

  // dev
  const res = await fetchWithTimeout(`/api/qqmusic-search/cgi-bin/musicu.fcg`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      req_1: {
        method: "DoSearchForQQMusicDesktop",
        module: "music.search.SearchCgiService",
        param: {
          num_per_page: PAGE_SIZE,
          page_num: page,
          query,
          search_type: 0,
        },
      },
    }),
    signal,
  });
  if (!res.ok) return { items: [], hasMore: false };
  const data: QqSearchResponse = await res.json();
  const list = data?.req_1?.data?.body?.song?.list || [];
  const total = data?.req_1?.data?.meta?.sum || 0;
  return {
    items: list.map(convertQqSearchSongToMusicTrack),
    hasMore: page * PAGE_SIZE < total,
  };
}

// --- QQ 音乐音频 URL ---

const QUALITY_MAP: Record<number, string> = {
  128: "128k",
  192: "320k",
  320: "320k",
};

function mapBrToQuality(br?: number): string {
  if (!br) return "320k";
  return QUALITY_MAP[br] || (br <= 128 ? "128k" : "320k");
}

export async function getQqMusicUrl(
  songmid: string,
  br?: number
): Promise<string | null> {
  const quality = mapBrToQuality(br);

  if (IS_WEB_PROD) {
    const apiUrl = getApiUrl();
    const res = await fetchWithTimeout(`${apiUrl}${QQ_PROXY_PREFIX}/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "url", songmid, quality }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data.url || null;
  }

  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      method: "GET",
      url: `${QQ_MEDIA_URL}/${songmid}/${quality}`,
      headers: { "X-Request-Key": "share-v3" },
    });
    if (res.status >= 400) return null;
    const data =
      typeof res.data === "string"
        ? (JSON.parse(res.data) as { url?: string })
        : (res.data as { url?: string });
    return data.url || null;
  }

  // dev
  try {
    const res = await fetchWithTimeout(
      `/api/qqmusic-url/${songmid}/${quality}`,
      { headers: { "X-Request-Key": "share-v3" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data.url || null;
  } catch {
    return null;
  }
}

// --- QQ 音乐歌词 ---

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseJsonpLyric(
  raw: string
): { lyric: string; trans?: string } | null {
  const jsonStr = raw.replace(/^[\w$.]+\s*\(/, "").replace(/\)\s*;?\s*$/, "");
  const data = JSON.parse(jsonStr);
  const lyric = decodeBase64Utf8(data.lyric || "");
  let trans: string | undefined;
  if (data.trans) {
    trans = decodeBase64Utf8(data.trans);
  }
  return { lyric, trans };
}

export async function getQqMusicLyric(
  songmid: string
): Promise<SongLyric | null> {
  if (IS_WEB_PROD) {
    const apiUrl = getApiUrl();
    const res = await fetchWithTimeout(`${apiUrl}${QQ_PROXY_PREFIX}/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "lyric", songmid }),
    });
    if (!res.ok) return null;
    return res.json();
  }

  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      method: "GET",
      url: `${QQ_LYRIC_URL}?songmid=${encodeURIComponent(songmid)}&pcachetime=${Date.now()}&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`,
      headers: { Referer: QQ_REFERER },
    });
    if (res.status >= 400) return null;
    const rawText =
      typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    const parsed = parseJsonpLyric(rawText);
    if (!parsed) return null;
    return {
      lyric: decodeHtmlEntities(parsed.lyric),
      tlyric: parsed.trans ? decodeHtmlEntities(parsed.trans) : undefined,
    };
  }

  // dev
  const res = await fetchWithTimeout(
    `/api/qqmusic-lyric/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${encodeURIComponent(songmid)}&pcachetime=${Date.now()}&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`
  );
  if (!res.ok) return null;
  const rawText = await res.text();
  const parsed = parseJsonpLyric(rawText);
  if (!parsed) return null;
  return {
    lyric: decodeHtmlEntities(parsed.lyric),
    tlyric: parsed.trans ? decodeHtmlEntities(parsed.trans) : undefined,
  };
}
