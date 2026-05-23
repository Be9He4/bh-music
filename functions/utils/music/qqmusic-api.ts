// --- QQ音乐 API 响应类型 (服务端自包含，不依赖 src/) ---

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

const API_URL = 'https://i.y.qq.com/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const QQ_REFERER = 'https://y.qq.com/';

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
export async function fetchQqPlaylistDetail(id: string): Promise<QqPlaylistDetail> {
  const url = buildQqPlaylistApiUrl(id);
  const res = await fetch(url, {
    headers: {
      'Referer': QQ_REFERER,
      'User-Agent': USER_AGENT,
    },
  });

  if (!res.ok) throw new Error(`QQ Music API error: ${res.status}`);

  const rawText = await res.text();
  const data = parseQqPlaylistResponse(rawText);

  if (data.code !== 0) throw new Error(`QQ Music API returned code ${data.code}`);
  if (data.subcode && data.subcode !== 0) throw new Error(data.msg || `QQ Music API returned subcode ${data.subcode}`);
  if (!data.cdlist?.length) throw new Error('歌单不存在或已被删除');

  const cd = data.cdlist[0];

  return {
    name: cd.dissname,
    coverUrl: cd.logo,
    trackCount: cd.songnum,
    songs: cd.songlist || [],
  };
}
