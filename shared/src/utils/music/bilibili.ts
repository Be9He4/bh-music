import type { MusicTrack, SearchPageResult } from "../../types/music";
import type {
  BilibiliDurlResponse,
  BilibiliPlayUrlResponse,
  BilibiliSearchResponse,
  BilibiliSearchVideoRaw,
  BilibiliViewResponse,
} from "../../types/music-platforms";
import { normalizeResourceUrl } from "../url";

export const BILIBILI_COVER_HOST_RE = /(^|\.)hdslb\.com$/;
const BILIBILI_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function buildBilibiliHeaders(referer = "https://www.bilibili.com/") {
  return {
    "User-Agent": BILIBILI_USER_AGENT,
    Referer: referer,
    Cookie: "buvid3=0",
  };
}

const HTML_TAG_RE = /<[^>]+>/g;
const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  apos: "'",
};

/**
 * 构建 B 站视频搜索接口路径。
 */
export function buildBilibiliSearchPath(
  keyword: string,
  page: number,
  rows = 20
): string {
  const params = new URLSearchParams({
    __refresh__: "true",
    page: String(page),
    page_size: String(rows),
    platform: "pc",
    keyword,
    search_type: "video",
  });
  return `/x/web-interface/search/type?${params.toString()}`;
}

/**
 * 构建 B 站视频详情接口路径。
 */
export function buildBilibiliViewPath(bvid: string): string {
  return `/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
}

/**
 * 构建 B 站 DASH 播放地址接口路径。
 */
export function buildBilibiliPlayUrlPath(bvid: string, cid: number): string {
  return `/x/player/playurl?fnval=16&bvid=${encodeURIComponent(bvid)}&cid=${cid}`;
}

/**
 * 构建 B 站 durl (FLV 分段) 播放地址接口路径，用于 DASH 不可用时的降级。
 */
export function buildBilibiliDurlPlayUrlPath(
  bvid: string,
  cid: number
): string {
  return `/x/player/playurl?fnval=0&bvid=${encodeURIComponent(bvid)}&cid=${cid}`;
}

/**
 * 去掉 B 站搜索高亮标签并解码常见 HTML 实体。
 */
export function normalizeBilibiliText(text: string | undefined): string {
  return (text || "未知标题")
    .replace(HTML_TAG_RE, "")
    .replace(/&([^;]+);/g, (_, entity: string) => HTML_ENTITY_MAP[entity] || "")
    .trim();
}

/**
 * 将 B 站搜索视频转换为通用 MusicTrack。
 */
export function convertBilibiliSearchVideoToMusicTrack(
  video: BilibiliSearchVideoRaw
): MusicTrack {
  const bvid = video.bvid || "";
  const coverUrl = normalizeResourceUrl(video.pic || "");

  return {
    id: `bilibili_${bvid}`,
    name: normalizeBilibiliText(video.title),
    artist: [normalizeBilibiliText(video.author || video.uname || "UP主")],
    album: "",
    pic_id: coverUrl,
    url_id: `bilibili_${bvid}`,
    lyric_id: "",
    source: "bilibili",
    artist_ids:
      video.mid === undefined || video.mid === null
        ? undefined
        : [String(video.mid)],
  };
}

/**
 * 解析 B 站搜索响应并转换为分页结果。
 */
export function parseBilibiliSearchResponse(
  response: BilibiliSearchResponse,
  page: number,
  rows = 20
): SearchPageResult<MusicTrack> {
  if (response.code !== 0) return { items: [], hasMore: false };

  const videos = (response.data?.result || []).filter(
    (item) => item.type === "video" && item.bvid
  );
  const total = response.data?.numResults || 0;

  return {
    items: videos.map(convertBilibiliSearchVideoToMusicTrack),
    hasMore: total > 0 ? page * rows < total : videos.length >= rows,
  };
}

/**
 * 解析 Otter 内部 B 站 track id。
 */
export function parseBilibiliTrackId(trackId: string): { bvid: string } | null {
  const match = trackId.match(/^bilibili_(BV[0-9A-Za-z]+)$/);
  return match ? { bvid: match[1] } : null;
}

/**
 * 从 B 站视频详情中取默认分 P 的 cid。
 */
export function selectBilibiliCid(
  response: BilibiliViewResponse
): number | null {
  const cid = response.data?.pages?.[0]?.cid || response.data?.cid || null;
  return typeof cid === "number" ? cid : null;
}

const AUDIO_URL_FIELDS = [
  "baseUrl",
  "base_url",
  "backupUrl",
  "backup_url",
  "url",
] as const;

function pickAudioUrl(entry: Record<string, unknown>): string | null {
  for (const field of AUDIO_URL_FIELDS) {
    const val = entry[field];
    if (typeof val === "string" && val.length > 0) return val;
  }
  return null;
}

/**
 * 从 B 站播放地址响应中选择最高带宽音频地址。
 * 按优先级匹配多个已知字段名：baseUrl → base_url → backupUrl → backup_url → url
 */
export function selectBilibiliAudioUrl(
  response: BilibiliPlayUrlResponse
): string | null {
  const audio = response.data?.dash?.audio || [];
  const selected = [...audio].sort(
    (a, b) => (b.bandwidth || 0) - (a.bandwidth || 0)
  )[0];
  if (!selected) return null;
  const url = pickAudioUrl(selected as unknown as Record<string, unknown>);
  return url ? normalizeResourceUrl(url) : null;
}

/**
 * 生成 playurl 响应的结构诊断信息，用于定位音频 URL 选择失败原因。
 */
export function describePlayurlResponse(
  response: BilibiliPlayUrlResponse
): string {
  const data = response.data;
  if (!data) return "response.data is null/undefined";

  const parts: string[] = [];
  parts.push(`data keys: [${Object.keys(data).join(", ")}]`);

  const dash = data.dash;
  if (!dash) {
    parts.push("dash: missing");
    return parts.join(", ");
  }

  parts.push(`dash keys: [${Object.keys(dash).join(", ")}]`);

  const audio = dash.audio;
  if (!audio) {
    parts.push("dash.audio: missing");
    return parts.join(", ");
  }

  parts.push(`dash.audio.length: ${audio.length}`);

  if (audio.length > 0) {
    const entryKeys = Object.keys(audio[0] as Record<string, unknown>);
    parts.push(`first entry keys: [${entryKeys.join(", ")}]`);
    parts.push(
      `first entry mimeType: ${(audio[0] as Record<string, unknown>).mimeType || "none"}`
    );
    parts.push(
      `first entry bandwidth: ${(audio[0] as Record<string, unknown>).bandwidth || "none"}`
    );
  }

  return parts.join(", ");
}

/**
 * 从 B 站 durl (FLV 分段) 响应中提取第一个 URL。
 * 当 DASH 音频不可用时作为降级方案。
 */
export function selectBilibiliDurlUrl(
  response: BilibiliDurlResponse
): string | null {
  const durl = response.data?.durl;
  if (!durl || durl.length === 0) return null;
  const url = durl[0].url;
  return url ? normalizeResourceUrl(url) : null;
}
