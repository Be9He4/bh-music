import type {
  AudioFormat,
  MusicTrack,
  SearchPageResult,
} from "../../types/music";
import type {
  BilibiliArcSearchResponse,
  BilibiliArcSearchVideoRaw,
  BilibiliDurlResponse,
  BilibiliPlayUrlResponse,
  BilibiliSearchResponse,
  BilibiliSearchVideoRaw,
  BilibiliPlayerResponse,
  BilibiliSeasonArchiveRaw,
  BilibiliSeasonSeriesListResponse,
  BilibiliSeasonsArchivesListResponse,
  BilibiliSeriesArchiveRaw,
  BilibiliSeriesArchivesResponse,
  BilibiliSeriesMetaRaw,
  BilibiliSeriesResponse,
  BilibiliSubtitleBodyItem,
  BilibiliSubtitleItem,
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
 * 构建 B 站系列详情接口路径。
 */
export function buildBilibiliSeriesDetailPath(seriesId: number): string {
  return `/x/series/series?series_id=${seriesId}`;
}

/**
 * 构建 B 站系列内视频列表接口路径。
 */
export function buildBilibiliSeriesArchivesPath(
  seriesId: number,
  page = 1,
  ps = 30
): string {
  return `/x/series/archives?series_id=${seriesId}&pn=${page}&ps=${ps}`;
}

/**
 * 构建 B 站视频合集 (seasons_archives) 列表接口路径。
 */
export function buildBilibiliSeasonsArchivesListPath(
  mid: number,
  seasonId: number,
  pageNum = 1,
  pageSize = 30
): string {
  return `/x/polymer/web-space/seasons_archives_list?mid=${mid}&season_id=${seasonId}&page_num=${pageNum}&page_size=${pageSize}`;
}

// ─────────────────────────────────────
// WBI 签名
// ─────────────────────────────────────

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
];

/**
 * 对 imgKey 和 subKey 进行字符顺序打乱编码，取前 32 位。
 */
export function getMixinKey(orig: string): string {
  let temp = "";
  for (const n of MIXIN_KEY_ENC_TAB) {
    temp += orig[n];
  }
  return temp.slice(0, 32);
}

/**
 * 从 nav 接口响应中提取 WBI 签名所需密钥。
 */
export function extractWbiKeys(response: {
  data?: { wbi_img?: { img_url?: string; sub_url?: string } };
}): { imgKey: string; subKey: string } | null {
  const wbi = response.data?.wbi_img;
  if (!wbi?.img_url || !wbi?.sub_url) return null;
  const imgKey = wbi.img_url.split("/").pop()?.split(".")[0] ?? "";
  const subKey = wbi.sub_url.split("/").pop()?.split(".")[0] ?? "";
  if (!imgKey || !subKey) return null;
  return { imgKey, subKey };
}

/**
 * 为请求参数进行 WBI 签名，返回完整 query string（含 w_rid 和 wts）。
 */
export async function signWbiParams(
  params: Record<string, string | number>,
  imgKey: string,
  subKey: string
): Promise<string> {
  const forge = await import("node-forge");
  const mixinKey = getMixinKey(imgKey + subKey);
  const currTime = Math.round(Date.now() / 1000);
  const chrFilter = /[!'()*]/g;

  const signed: Record<string, string | number> = { ...params, wts: currTime };
  const queryParts: string[] = [];
  Object.keys(signed)
    .sort()
    .forEach((key) => {
      const value = String(signed[key]).replace(chrFilter, "");
      queryParts.push(
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
      );
    });

  const queryString = queryParts.join("&");
  const md5 = forge.md.md5.create();
  md5.update(forge.util.encodeUtf8(queryString + mixinKey));
  const wbiSign = md5.digest().toHex();

  return `${queryString}&w_rid=${wbiSign}`;
}

// ─────────────────────────────────────
// 用户详情
// ─────────────────────────────────────

/**
 * 构建 B 站用户详情接口路径（需要 WBI 签名）。
 */
export function buildBilibiliUserCardPath(mid: number): string {
  return `/x/space/wbi/acc/info?mid=${mid}`;
}

/**
 * 构建 B 站 nav 接口路径（获取 WBI 签名密钥）。
 */
export function buildBilibiliNavPath(): string {
  return `/x/web-interface/nav`;
}

/**
 * 构建 B 站用户空间视频列表接口路径（需要 WBI 签名）。
 */
export function buildBilibiliArcSearchPath(
  mid: number,
  page = 1,
  size = 30
): string {
  return `/x/space/wbi/arc/search?mid=${mid}&pn=${page}&ps=${size}&order=pubdate&platform=web`;
}

/**
 * 构建 B 站用户合集列表接口路径（seasons_series_list）。
 */
export function buildBilibiliSeasonSeriesListPath(
  mid: number,
  pageNum = 1,
  pageSize = 100
): string {
  return `/x/polymer/web-space/seasons_series_list?mid=${mid}&page_num=${pageNum}&page_size=${pageSize}`;
}

/**
 * 解析 B 站用户详情响应。
 */
export function parseBilibiliUserInfo(
  response: import("../../types/music-platforms").BilibiliUserCardResponse
): { mid: number; name: string; face: string } | null {
  if (response.code !== 0) return null;
  const data = response.data;
  if (!data) return null;
  return {
    mid: Number(data.mid),
    name: data.name,
    face: data.face,
  };
}

/**
 * 将 B 站用户空间视频转换为通用 MusicTrack。
 */
export function convertBilibiliArcSearchVideoToMusicTrack(
  video: BilibiliArcSearchVideoRaw,
  upName: string
): MusicTrack {
  const bvid = video.bvid || "";
  const coverUrl = normalizeResourceUrl(video.pic || "");

  return {
    id: `bilibili_${bvid}`,
    name: normalizeBilibiliText(video.title),
    artist: [upName || normalizeBilibiliText(video.author || "")],
    album: "",
    pic_id: coverUrl,
    url_id: `bilibili_${bvid}`,
    lyric_id: `bilibili_${bvid}`,
    source: "bilibili",
    artist_ids:
      video.mid === undefined || video.mid === null
        ? undefined
        : [String(video.mid)],
  };
}

/**
 * 解析 B 站用户空间视频列表响应并转换为分页结果。
 */
export function parseBilibiliArcSearchResponse(
  response: BilibiliArcSearchResponse,
  upName: string,
  page: number,
  size: number
): SearchPageResult<MusicTrack> {
  if (response.code !== 0) return { items: [], hasMore: false };

  const videos = response.data?.list?.vlist || [];
  const total = response.data?.page?.count || 0;

  return {
    items: videos.map((v) =>
      convertBilibiliArcSearchVideoToMusicTrack(v, upName)
    ),
    hasMore: total > 0 ? page * size < total : videos.length >= size,
  };
}

export interface BilibiliUpSeasonSummary {
  id: string;
  name: string;
  cover: string;
  count: number;
}

/**
 * 解析 B 站用户合集列表响应，转为专辑条目。
 * 响应结构为 data.items_lists.seasons_list[]，合集信息在 meta 中。
 * 仅取 seasons（合集），专辑 ID 为 bilibili_S_{seasonId}_{mid}。
 */
export function parseBilibiliUpSeasonSeriesList(
  response: BilibiliSeasonSeriesListResponse,
  mid: number
): BilibiliUpSeasonSummary[] {
  if (response.code !== 0) return [];
  const seasons = response.data?.items_lists?.seasons_list || [];
  return seasons
    .map((s) => s.meta)
    .filter((m): m is NonNullable<typeof m> => Boolean(m?.season_id))
    .map((m) => ({
      id: buildBilibiliSeriesAlbumId(m.season_id as number, mid),
      name: m.name || "合集",
      cover: normalizeResourceUrl(m.cover || ""),
      count: m.total || 0,
    }));
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
  return (text ?? "未知标题")
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
    artist: [normalizeBilibiliText(video.author || video.uname || "")],
    album: "",
    pic_id: coverUrl,
    url_id: `bilibili_${bvid}`,
    lyric_id: `bilibili_${bvid}`,
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
export function parseBilibiliTrackId(
  trackId: string
): { bvid: string; cid?: number } | null {
  const match = trackId.match(/^bilibili_BV([0-9A-Za-z]+)(?:_(\d+))?$/);
  return match
    ? { bvid: `BV${match[1]}`, ...(match[2] ? { cid: Number(match[2]) } : {}) }
    : null;
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
 * 从 DASH 音频项的 mimeType 推断 AudioFormat。
 * B 站 DASH 音频通常为 audio/mp4 (m4s) 或 audio/x-flv (flv)。
 */
export function inferAudioFormatFromMime(
  mimeType?: string | null
): AudioFormat {
  if (!mimeType) return "m4a";
  const m = mimeType.toLowerCase();
  if (m.includes("flv")) return "flv";
  if (m.includes("mp4") || m.includes("m4a")) return "m4s";
  return "m4a";
}

/**
 * 从音频 URL 路径推断 AudioFormat（durl 降级路径使用）。
 * 形如 .../.../123.m4s?xxx 或 .../.../xxx.flv
 */
export function inferAudioFormatFromUrl(audioUrl: string): AudioFormat {
  const lower = audioUrl.toLowerCase().split("?")[0] ?? "";
  if (lower.endsWith(".flv")) return "flv";
  if (
    lower.endsWith(".m4s") ||
    lower.endsWith(".m4a") ||
    lower.endsWith(".mp4")
  )
    return "m4s";
  return "m4a";
}

/**
 * 从 B 站播放地址响应中选择最高带宽音频地址。
 * 按优先级匹配多个已知字段名：baseUrl → base_url → backupUrl → backup_url → url
 */
export function selectBilibiliAudioUrl(
  response: BilibiliPlayUrlResponse
): { url: string; format: AudioFormat } | null {
  const audio = response.data?.dash?.audio || [];
  const selected = [...audio].sort(
    (a, b) => (b.bandwidth || 0) - (a.bandwidth || 0)
  )[0];
  if (!selected) return null;
  const url = pickAudioUrl(selected as unknown as Record<string, unknown>);
  if (!url) return null;
  const normalized = normalizeResourceUrl(url);
  const format = inferAudioFormatFromMime(
    (selected as unknown as Record<string, unknown>).mimeType as
      | string
      | undefined
  );
  return { url: normalized, format };
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
): { url: string; format: AudioFormat } | null {
  const durl = response.data?.durl;
  if (!durl || durl.length === 0) return null;
  const url = durl[0].url;
  if (!url) return null;
  const normalized = normalizeResourceUrl(url);
  return { url: normalized, format: inferAudioFormatFromUrl(normalized) };
}

// ─────────────────────────────────────
// 合集 / 系列 数据转换
// ─────────────────────────────────────

export function buildBilibiliSeriesAlbumId(
  seriesId: number,
  mid?: number
): string {
  if (mid !== undefined && mid !== null) {
    return `bilibili_S_${seriesId}_${mid}`;
  }
  return `bilibili_S_${seriesId}`;
}

export interface ParsedBilibiliAlbumId {
  seriesId: string;
  mid?: string;
}

export function parseBilibiliAlbumId(
  albumId: string
): ParsedBilibiliAlbumId | null {
  const newMatch = albumId.match(/^bilibili_S_(\d+)_(\d+)$/);
  if (newMatch) return { seriesId: newMatch[1], mid: newMatch[2] };
  const oldMatch = albumId.match(/^bilibili_S_(\d+)$/);
  if (oldMatch) return { seriesId: oldMatch[1] };
  return null;
}

export function buildBilibiliMultiPAlbumId(bvid: string): string {
  return `bilibili_V_${bvid}`;
}

export function parseBilibiliMultiPAlbumId(albumId: string): string | null {
  const match = albumId.match(/^bilibili_V_(BV[0-9A-Za-z]+)$/);
  return match ? match[1] : null;
}

/**
 * 将 B 站系列元数据转换为 MusicTrack（作为专辑条目）。
 * 专辑 ID 格式：bilibili_S_{series_id}
 */
export function convertSeriesToMusicTrack(
  meta: BilibiliSeriesMetaRaw
): MusicTrack {
  const seriesId = meta.series_id ?? 0;
  const coverUrl = normalizeResourceUrl(meta.cover || "");

  return {
    id: buildBilibiliSeriesAlbumId(seriesId),
    name: normalizeBilibiliText(meta.name),
    artist: [normalizeBilibiliText(meta.creator?.name || "")],
    album: "",
    pic_id: coverUrl,
    url_id: `bilibili_series_${seriesId}`,
    lyric_id: "",
    source: "bilibili",
    artist_ids:
      meta.creator?.mid !== undefined ? [String(meta.creator.mid)] : undefined,
  };
}

/**
 * 将 B 站系列内视频转换为 MusicTrack。
 */
export function convertSeriesArchiveToMusicTrack(
  archive: BilibiliSeriesArchiveRaw,
  albumId?: string
): MusicTrack {
  const bvid = archive.bvid || "";
  const coverUrl = normalizeResourceUrl(archive.cover || "");

  return {
    id: `bilibili_${bvid}`,
    name: normalizeBilibiliText(archive.title),
    artist: [normalizeBilibiliText(archive.owner?.name || "")],
    album: "",
    album_id: albumId,
    pic_id: coverUrl,
    url_id: `bilibili_${bvid}`,
    lyric_id: `bilibili_${bvid}`,
    source: "bilibili",
    artist_ids:
      archive.owner?.mid !== undefined
        ? [String(archive.owner.mid)]
        : undefined,
  };
}

/**
 * 解析 B 站系列详情的 meta 信息。
 */
export function parseBilibiliSeriesDetail(
  response: BilibiliSeriesResponse
): BilibiliSeriesMetaRaw | null {
  if (response.code !== 0) return null;
  return response.data?.meta ?? null;
}

/**
 * 解析 B 站系列内视频列表。
 */
export function parseBilibiliSeriesArchives(
  response: BilibiliSeriesArchivesResponse
): { archives: BilibiliSeriesArchiveRaw[]; total: number } {
  if (response.code !== 0) return { archives: [], total: 0 };
  return {
    archives: response.data?.archives || [],
    total: response.data?.page?.total || 0,
  };
}

/**
 * 解析 B 站视频合集 (seasons_archives) 列表响应。
 */
export function parseBilibiliSeasonsArchivesList(
  response: BilibiliSeasonsArchivesListResponse
): {
  meta: BilibiliSeriesMetaRaw | null;
  archives: BilibiliSeasonArchiveRaw[];
  total: number;
  mid?: number;
} {
  if (response.code !== 0) return { meta: null, archives: [], total: 0 };
  const rawMeta = response.data?.meta;
  return {
    meta: rawMeta
      ? {
          series_id: rawMeta.season_id,
          name: rawMeta.name,
          cover: normalizeResourceUrl(rawMeta.cover || ""),
          description: rawMeta.description,
          // seasons_archives_list 返回的 meta 中没有 UP 主名称，只有 mid
          // 需要通过额外的 API 调用获取 UP 主名称
          creator: rawMeta.mid !== undefined ? { mid: rawMeta.mid } : undefined,
          total: rawMeta.total,
        }
      : null,
    archives: response.data?.archives ?? [],
    total: response.data?.page?.total ?? 0,
    mid: rawMeta?.mid,
  };
}

// ─────────────────────────────────────
// 字幕 (player/v2) 与 LRC 转换
// ─────────────────────────────────────

/**
 * 构建 B 站播放器信息接口路径（含字幕信息）。
 * 使用 /x/player/wbi/v2：B 站播放器现行字幕接口，返回稳定；
 * 旧接口 /x/player/v2 的字幕数据随机/不稳定（时有时无或串台）。
 */
export function buildBilibiliPlayerPath(bvid: string, cid: number): string {
  return `/x/player/wbi/v2?bvid=${encodeURIComponent(bvid)}&cid=${cid}`;
}

const AI_SUBTITLE_LAN_PREFIX = "ai-";

/**
 * 归一化字幕语言标识：AI 字幕去掉 "ai-" 前缀，locale 取语言代码，
 * 使 "ai-zh"、"zh-CN" 归并为同一语言组 "zh"。
 */
export function bilibiliSubtitleLang(item: BilibiliSubtitleItem): string {
  const lan = (item.lan || "").replace(AI_SUBTITLE_LAN_PREFIX, "");
  return lan.split("-")[0].toLowerCase();
}

/**
 * 判断字幕是否为 B 站 AI 自动生成。
 */
export function isBilibiliAiSubtitle(item: BilibiliSubtitleItem): boolean {
  return Boolean(
    item.ai_status ||
    item.ai_type ||
    item.lan?.startsWith(AI_SUBTITLE_LAN_PREFIX)
  );
}

export interface BilibiliSubtitleSelection {
  primary: BilibiliSubtitleItem | null;
  translation: BilibiliSubtitleItem | null;
}

/**
 * 从字幕轨道列表中选择主歌词与翻译字幕。
 * 策略：
 * - 两级优先：人工（UP主上传）字幕整体优先于 AI 字幕；AI 仅在无人工候选时兜底。
 * - 同一语言内人工字幕优先于 AI 字幕。
 * - 主歌词优先中文，否则取首个可用语言；翻译优先其他语言（英文优先）。
 * - 返回的 item 带 `originalLan` / `isAi` 标记，便于上层区分 AI 字幕。
 */
export function selectBilibiliSubtitleItems(
  subtitles: BilibiliSubtitleItem[]
): BilibiliSubtitleSelection {
  const usable = subtitles
    .filter((s) => s.subtitle_url && s.lan)
    .map((s) => ({
      ...s,
      originalLan: s.lan,
      isAi: isBilibiliAiSubtitle(s),
    }));
  if (usable.length === 0) return { primary: null, translation: null };

  const normLang = (s: BilibiliSubtitleItem): string => bilibiliSubtitleLang(s);

  const humanPool = usable.filter((s) => !s.isAi);
  const aiPool = usable.filter((s) => s.isAi);

  const pickInPool = (
    pool: BilibiliSubtitleItem[],
    lang: string
  ): BilibiliSubtitleItem | null => {
    const list = pool.filter((s) => normLang(s) === lang);
    if (list.length === 0) return null;
    return list.find((s) => !s.isAi) ?? list[0];
  };

  const firstLangOf = (pool: BilibiliSubtitleItem[]): string => {
    if (pool.some((s) => normLang(s) === "zh")) return "zh";
    if (pool.some((s) => normLang(s) === "en")) return "en";
    return pool[0] ? normLang(pool[0]) : "";
  };

  // 主歌词：人工字幕优先，其次 AI 兜底
  const primary: BilibiliSubtitleItem | null =
    pickInPool(humanPool, firstLangOf(humanPool)) ??
    pickInPool(aiPool, firstLangOf(aiPool));

  if (!primary) return { primary: null, translation: null };

  const primaryLang = normLang(primary);
  const otherLang = (s: BilibiliSubtitleItem): boolean =>
    normLang(s) !== primaryLang;

  // 翻译：优先其他语言的人工字幕，其次 AI
  const translation: BilibiliSubtitleItem | null =
    humanPool.find((s) => otherLang(s) && normLang(s) === "en") ??
    humanPool.find((s) => otherLang(s)) ??
    aiPool.find((s) => otherLang(s) && normLang(s) === "en") ??
    aiPool.find((s) => otherLang(s)) ??
    null;

  return { primary, translation };
}

/**
 * 从 player/wbi/v2 响应的字幕列表中选择主歌词与翻译字幕。
 */
export function selectBilibiliSubtitles(
  response: BilibiliPlayerResponse | null
): BilibiliSubtitleSelection {
  return selectBilibiliSubtitleItems(response?.data?.subtitle?.subtitles || []);
}

/**
 * 将 B 站字幕 body 转换为 LRC 字符串。
 * 多行 content 合并为空格，时间格式为 [mm:ss.xx]。
 */
export function convertBilibiliSubtitleToLrc(
  body: BilibiliSubtitleBodyItem[]
): string {
  return body
    .map((item) => {
      const from = item.from;
      if (typeof from !== "number" || !item.content) return "";
      const mins = Math.floor(from / 60);
      const secs = Math.floor(from % 60);
      const ms = Math.round((from - Math.floor(from)) * 100);
      const text = item.content.replace(/\s+/g, " ").trim();
      if (!text) return "";
      return `[${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(2, "0")}]${text}`;
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * 归一化字幕 URL：相对协议补全为 https，空值返回空串。
 */
export function normalizeBilibiliSubtitleUrl(url: string | undefined): string {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  return url;
}

/**
 * 将 B 站合集 (seasons_archives) 内视频转换为 MusicTrack。
 * @param archive - 合集内视频的原始数据
 * @param upName - UP主名称
 */
export function convertSeasonArchiveToMusicTrack(
  archive: BilibiliSeasonArchiveRaw,
  upName?: string,
  albumId?: string
): MusicTrack {
  const bvid = archive.bvid || "";
  const coverUrl = normalizeResourceUrl(archive.pic || "");

  return {
    id: `bilibili_${bvid}`,
    name: normalizeBilibiliText(archive.title),
    artist: [upName || "UP主"],
    album: archive.title,
    album_id: albumId ?? buildBilibiliMultiPAlbumId(bvid),
    pic_id: coverUrl,
    url_id: `bilibili_${bvid}`,
    lyric_id: `bilibili_${bvid}`,
    source: "bilibili",
  };
}
