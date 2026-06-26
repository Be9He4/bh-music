import type { MusicTrack } from "../../types/music";
import type {
  QqPlaylistResponse,
  QqSongRaw,
  QqSearchSongRaw,
  QqVkeyResponse,
} from "../../types/music-platforms";

// ─────────────────────────────────────
// 常量
// ─────────────────────────────────────

export const QQ_BASE_URL = "https://i.y.qq.com";
export const QQ_API_URL = "https://u.y.qq.com/cgi-bin/musicu.fcg";
export const QQ_LYRIC_URL =
  "https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg";
export const QQ_REFERER = "https://y.qq.com/";

/** vkey API 文件名前缀与质量映射 */
export const QQ_FILE_CONFIG = [
  { key: "320k", prefix: "M800", ext: ".mp3" },
  { key: "128k", prefix: "M500", ext: ".mp3" },
  { key: "m4a", prefix: "C400", ext: ".m4a" },
] as const;

// ─────────────────────────────────────
// 歌单
// ─────────────────────────────────────

/**
 * 构建 QQ 音乐歌单 API 请求路径（不含域名/代理前缀）。
 */
export function buildQqPlaylistApiPath(playlistId: string): string {
  return `/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&nosign=1&disstid=${encodeURIComponent(playlistId)}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=GB2312&outCharset=utf-8&notice=0&platform=yqq&needNewCode=0`;
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

function extractQqFee(song: {
  pay?: {
    payplay?: number;
    paydownload?: number;
    pay_play?: number;
    pay_down?: number;
  };
}): number | undefined {
  const payPlay = song.pay?.payplay ?? song.pay?.pay_play;
  if (payPlay === 1) return 1;
  return undefined;
}

/**
 * 将 QQ 音乐歌单中的歌曲对象转换为 MusicTrack。
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
    fee: extractQqFee(song),
  };
}

// ─────────────────────────────────────
// 搜索
// ─────────────────────────────────────

/**
 * 将 QQ 音乐搜索结果中的歌曲对象转换为 MusicTrack。
 */
export function convertQqSearchSongToMusicTrack(
  song: QqSearchSongRaw
): MusicTrack {
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
    fee: extractQqFee(song),
  };
}

// ─────────────────────────────────────
// vkey 音频 URL
// ─────────────────────────────────────

/**
 * 构建 vkey 请求体
 * @param songmid 歌曲 mid
 * @param qualityKeys 按优先级排列的质量配置键名
 */
export function buildVkeyRequestBody(
  songmid: string,
  qualityKeys: readonly string[]
) {
  const filenames = qualityKeys
    .map((key) => {
      const cfg = QQ_FILE_CONFIG.find((c) => c.key === key);
      return cfg ? `${cfg.prefix}${songmid}${songmid}${cfg.ext}` : "";
    })
    .filter(Boolean);

  return {
    req_1: {
      module: "vkey.GetVkeyServer",
      method: "CgiGetVkey",
      param: {
        filename: filenames,
        guid: "10000",
        songmid: qualityKeys.map(() => songmid),
        songtype: qualityKeys.map(() => 0),
        uin: "0",
        loginflag: 1,
        platform: "20",
      },
    },
    loginUin: "0",
    comm: {
      uin: "0",
      format: "json",
      ct: 24,
      cv: 0,
    },
  };
}

/**
 * 从 vkey 响应中提取可用音频 URL，返回第一个 purl 非空的链接
 */
export function extractVkeyUrl(data: QqVkeyResponse): string | null {
  const sip = data.req_1?.data?.sip;
  const midurlinfo = data.req_1?.data?.midurlinfo;
  if (!sip?.length || !midurlinfo?.length) return null;

  for (const info of midurlinfo) {
    if (info.purl) {
      return sip[0] + info.purl;
    }
  }
  return null;
}

// ─────────────────────────────────────
// 歌词
// ─────────────────────────────────────

/**
 * 解码 HTML 实体（歌词文本中使用）。
 * 支持 数字实体引用 (&#NNN;, &#xHH;) 和 命名实体。
 */
export function decodeQqHtmlEntities(text: string): string {
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
