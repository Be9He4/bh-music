import type { MusicTrack, SearchPageResult } from "@otter-music/shared";
import forge from "node-forge";

interface QqPlaylistResponse {
  code: number;
  subcode?: number;
  msg?: string;
  cdlist: QqCdItem[];
}

interface QqCdItem {
  dissid: string;
  dissname: string;
  logo: string;
  songnum: number;
  songlist: QqSongRaw[];
}

interface QqSongRaw {
  songid: string;
  songmid: string;
  songname: string;
  singer: { name: string }[];
  albumname: string;
  albummid: string;
  interval: number;
}

export interface QqPlaylistDetail {
  name: string;
  coverUrl: string;
  trackCount: number;
  songs: QqSongRaw[];
}

// --- API 调用 ---

const API_URL =
  "https://i.y.qq.com/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const QQ_REFERER = "https://y.qq.com/";

/**
 * 解析 QQ 音乐接口响应，优先按纯 JSON 处理，失败后兼容 JSONP 包装。
 */
function parseQqPlaylistResponse(text: string): QqPlaylistResponse {
  try {
    return JSON.parse(text) as QqPlaylistResponse;
  } catch (jsonError) {
    const jsonpMatch = text.trim().match(/^[\w$.]+\s*\(([\s\S]*)\)\s*;?$/);
    if (!jsonpMatch) throw jsonError;
    return JSON.parse(jsonpMatch[1]) as QqPlaylistResponse;
  }
}

/**
 * 构建 QQ 音乐歌单 API 完整请求 URL。
 * 抽离为纯函数以便测试。
 */
export function buildQqPlaylistApiUrl(id: string): string {
  return `${API_URL}?type=1&json=1&utf8=1&nosign=1&disstid=${encodeURIComponent(id)}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=GB2312&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`;
}

/**
 * 根据歌单 ID 获取 QQ 音乐歌单详情。
 * 在 Cloudflare Worker 环境中运行，绕过浏览器 CORS 限制。
 */
export async function fetchQqPlaylistDetail(
  id: string
): Promise<QqPlaylistDetail> {
  const url = buildQqPlaylistApiUrl(id);
  const res = await fetch(url, {
    headers: {
      Referer: QQ_REFERER,
      "User-Agent": USER_AGENT,
    },
  });

  if (!res.ok) throw new Error(`QQ Music API error: ${res.status}`);

  const rawText = await res.text();
  const data = parseQqPlaylistResponse(rawText);

  if (data.code !== 0)
    throw new Error(`QQ Music API returned code ${data.code}`);
  if (data.subcode && data.subcode !== 0)
    throw new Error(
      data.msg || `QQ Music API returned subcode ${data.subcode}`
    );
  if (!data.cdlist?.length) throw new Error("歌单不存在或已被删除");

  const cd = data.cdlist[0];

  return {
    name: cd.dissname,
    coverUrl: cd.logo,
    trackCount: cd.songnum,
    songs: cd.songlist || [],
  };
}

// --- QQ 音乐搜索 (Worker 端) ---

function convertQqSearchSongToMusicTrack(song: any): MusicTrack {
  const songmid = song.mid || song.songmid || "";
  const albummid = song.album?.mid || song.albummid || "";
  const picUrl = albummid
    ? `https://y.gtimg.cn/music/photo_new/T002R800x800M000${albummid}.jpg`
    : "";
  return {
    id: `qq_${songmid}`,
    name: song.title || song.songname || "",
    artist: (song.singer || []).map((s: any) => s.name),
    album: song.album?.title || song.albumname || "",
    pic_id: picUrl,
    url_id: songmid,
    lyric_id: songmid,
    source: "qq",
  };
}

export async function fetchQqMusicSearch(
  query: string,
  page: number
): Promise<SearchPageResult<MusicTrack>> {
  const res = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
    method: "POST",
    headers: {
      Referer: QQ_REFERER,
      "User-Agent": USER_AGENT,
      "Content-Type": "application/json",
      Cookie: "uin=",
    },
    body: JSON.stringify({
      req_1: {
        method: "DoSearchForQQMusicDesktop",
        module: "music.search.SearchCgiService",
        param: {
          num_per_page: 20,
          page_num: page,
          query,
          search_type: 0,
        },
      },
    }),
  });
  if (!res.ok) return { items: [], hasMore: false };
  const data: any = await res.json();
  const list = data?.req_1?.data?.body?.song?.list || [];
  const total = data?.req_1?.data?.meta?.sum || 0;
  return {
    items: list.map(convertQqSearchSongToMusicTrack),
    hasMore: page * 20 < total,
  };
}

// --- QQ 音乐歌词 (Worker 端) ---

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCharCode(parseInt(code, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export async function fetchQqMusicLyric(songmid: string) {
  const res = await fetch(
    `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${encodeURIComponent(songmid)}&pcachetime=${Date.now()}&g_tk=5381&loginUin=0&hostUin=0&inCharset=utf8&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`,
    {
      headers: {
        Referer: QQ_REFERER,
        "User-Agent": USER_AGENT,
        Cookie: "uin=",
      },
    }
  );
  if (!res.ok) return null;
  const rawText = await res.text();
  const jsonStr = rawText
    .replace(/^[\w$.]+\s*\(/, "")
    .replace(/\)\s*;?\s*$/, "");
  const data = JSON.parse(jsonStr);
  const lyric = forge.util.decodeUtf8(forge.util.decode64(data.lyric || ""));
  let tlyric: string | undefined;
  if (data.trans) {
    tlyric = forge.util.decodeUtf8(forge.util.decode64(data.trans));
  }
  return {
    lyric: decodeHtmlEntities(lyric),
    tlyric: tlyric ? decodeHtmlEntities(tlyric) : undefined,
  };
}

// --- QQ 音乐音频 URL (Worker 端) ---

export async function fetchQqMusicUrl(
  songmid: string,
  quality: string
): Promise<{ url?: string }> {
  const res = await fetch(
    `https://lxmusicapi.onrender.com/url/tx/${songmid}/${quality}`,
    { headers: { "X-Request-Key": "share-v3" } }
  );
  if (!res.ok) return {};
  return (await res.json()) as { url?: string };
}
