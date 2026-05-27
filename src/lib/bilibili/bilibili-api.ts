import {
  fetchWithTimeout,
  getApiUrl,
  IS_NATIVE,
  IS_WEB_PROD,
} from "@/lib/api/config";
import {
  buildBilibiliDurlPlayUrlPath,
  buildBilibiliHeaders,
  buildBilibiliPlayUrlPath,
  buildBilibiliSearchPath,
  buildBilibiliViewPath,
  describePlayurlResponse,
  parseBilibiliSearchResponse,
  parseBilibiliTrackId,
  selectBilibiliAudioUrl,
  selectBilibiliCid,
  selectBilibiliDurlUrl,
  type BilibiliDurlResponse,
  type BilibiliPlayUrlResponse,
  type BilibiliSearchResponse,
  type BilibiliViewResponse,
  type MusicTrack,
  type SearchPageResult,
} from "@otter-music/shared";
import { registerBlobUrl } from "@/lib/utils/blob-registry";
import { base64ToBlob } from "@/lib/utils/base64";
import { logger } from "../logger";

const BILIBILI_API_BASE = "https://api.bilibili.com";
const BILIBILI_PROXY_PREFIX = "/music-api/bilibili";
const BILIBILI_DEV_AUDIO_PROXY = "/api/bilibili-audio";
const BILIBILI_DEV_COVER_PROXY = "/api/bilibili-cover";
const NETWORK_TIMEOUT = 12000;
const NATIVE_CONNECT_TIMEOUT = 10000;
const NATIVE_READ_TIMEOUT = 15000;

function ensureBlob(data: unknown, mimeType: string): Blob | null {
  if (data instanceof Blob) return data;
  if (typeof data === "string") {
    let base64 = data;
    if (data.startsWith("data:")) {
      const commaIdx = data.indexOf(",");
      base64 = commaIdx >= 0 ? data.substring(commaIdx + 1) : data;
    }
    try {
      return base64ToBlob(base64, mimeType);
    } catch {
      return null;
    }
  }
  return null;
}

function buildBilibiliAudioProxyUrl(bvid: string, audioUrl: string): string {
  const params = new URLSearchParams({ bvid, url: audioUrl });
  if (!IS_NATIVE && !IS_WEB_PROD) {
    return `${BILIBILI_DEV_AUDIO_PROXY}?${params.toString()}`;
  }
  return `${getApiUrl()}${BILIBILI_PROXY_PREFIX}/audio?${params.toString()}`;
}

/**
 * 从 B站 playurl 响应中提取音频URL，DASH 失败时尝试 durl 降级。
 */
async function resolveBilibiliAudioUrl(
  bvid: string,
  cid: number,
  referer: string
): Promise<{ url: string; source: "dash" | "durl" } | null> {
  // 尝试 DASH 格式 (fnval=16)
  const playUrl = await fetchBilibiliJson<BilibiliPlayUrlResponse>(
    buildBilibiliPlayUrlPath(bvid, cid),
    referer
  );
  let audioUrl = playUrl ? selectBilibiliAudioUrl(playUrl) : null;

  if (audioUrl) return { url: audioUrl, source: "dash" };

  // 诊断日志
  if (playUrl) {
    logger.warn(
      "[bilibili] DASH audio URL not found:",
      describePlayurlResponse(playUrl)
    );
  } else {
    logger.warn("[bilibili] DASH playurl request returned null");
  }

  // 降级：durl 格式 (fnval=0)
  const durlResponse = await fetchBilibiliJson<BilibiliDurlResponse>(
    buildBilibiliDurlPlayUrlPath(bvid, cid),
    referer
  );
  audioUrl = durlResponse ? selectBilibiliDurlUrl(durlResponse) : null;
  if (audioUrl) {
    logger.warn("[bilibili] Using durl fallback for audio");
    return { url: audioUrl, source: "durl" };
  }

  return null;
}

export async function getBilibiliCoverUrl(
  coverUrl: string
): Promise<string | null> {
  if (!coverUrl) return null;

  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      method: "GET",
      url: coverUrl,
      headers: buildBilibiliHeaders(),
      responseType: "blob",
    });
    if (res.status >= 400) return null;
    const blob = ensureBlob(
      res.data,
      res.headers?.["Content-Type"] || "image/jpeg"
    );
    if (!blob) return null;
    const blobUrl = URL.createObjectURL(blob);
    registerBlobUrl(blobUrl);
    return blobUrl;
  }

  const params = new URLSearchParams({ url: coverUrl });
  if (!IS_WEB_PROD) return `${BILIBILI_DEV_COVER_PROXY}?${params.toString()}`;
  return `${getApiUrl()}${BILIBILI_PROXY_PREFIX}/cover?${params.toString()}`;
}

async function fetchBilibiliJson<T>(
  path: string,
  referer?: string
): Promise<T | null> {
  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      method: "GET",
      url: `${BILIBILI_API_BASE}${path}`,
      headers: buildBilibiliHeaders(referer),
      connectTimeout: NATIVE_CONNECT_TIMEOUT,
      readTimeout: NATIVE_READ_TIMEOUT,
    });
    if (res.status >= 400) return null;
    return typeof res.data === "string" ? JSON.parse(res.data) : res.data;
  }

  const res = await fetchWithTimeout(
    `/api/bilibili${path}`,
    { headers: buildBilibiliHeaders(referer) },
    NETWORK_TIMEOUT
  );
  if (!res.ok) return null;
  return res.json();
}

export async function searchBilibiliVideos(
  keyword: string,
  page: number,
  rows = 20
): Promise<SearchPageResult<MusicTrack>> {
  if (IS_WEB_PROD) {
    const res = await fetchWithTimeout(
      `${getApiUrl()}${BILIBILI_PROXY_PREFIX}/search`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, page, rows }),
      },
      NETWORK_TIMEOUT
    );
    if (!res.ok) return { items: [], hasMore: false };
    return res.json();
  }

  try {
    const data = await fetchBilibiliJson<BilibiliSearchResponse>(
      buildBilibiliSearchPath(keyword, page, rows)
    );
    return data
      ? parseBilibiliSearchResponse(data, page, rows)
      : { items: [], hasMore: false };
  } catch {
    return { items: [], hasMore: false };
  }
}

/**
 * Web端获取B站音频URL
 * 返回代理URL，浏览器原生流式播放
 */
async function getBilibiliSongUrlWeb(bvid: string): Promise<string | null> {
  if (IS_WEB_PROD) {
    const res = await fetchWithTimeout(
      `${getApiUrl()}${BILIBILI_PROXY_PREFIX}/song-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bvid }),
      },
      NETWORK_TIMEOUT
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string | null };
    if (!data.url) return null;
    // 返回代理URL，支持Range请求，浏览器原生流式播放
    return buildBilibiliAudioProxyUrl(bvid, data.url);
  }

  // 开发环境直接获取
  try {
    const referer = `https://www.bilibili.com/video/${bvid}`;
    const view = await fetchBilibiliJson<BilibiliViewResponse>(
      buildBilibiliViewPath(bvid),
      referer
    );
    if (!view) return null;
    const cid = selectBilibiliCid(view);
    if (!cid) return null;

    const result = await resolveBilibiliAudioUrl(bvid, cid, referer);
    if (!result) return null;
    return buildBilibiliAudioProxyUrl(bvid, result.url);
  } catch {
    return null;
  }
}

/**
 * Android端获取B站音频URL
 * 使用本地代理实现真正的流式播放
 */
async function getBilibiliSongUrlNative(bvid: string): Promise<string | null> {
  try {
    const { getNativeBilibiliStreamUrl } =
      await import("./bilibili-native-player");
    const referer = `https://www.bilibili.com/video/${bvid}`;

    const view = await fetchBilibiliJson<BilibiliViewResponse>(
      buildBilibiliViewPath(bvid),
      referer
    );
    if (!view) return null;

    const cid = selectBilibiliCid(view);
    if (!cid) return null;

    const result = await resolveBilibiliAudioUrl(bvid, cid, referer);
    if (!result) return null;

    return getNativeBilibiliStreamUrl(result.url, bvid);
  } catch (e) {
    logger.error("[bilibili] Error getting native song URL:", e);
    return null;
  }
}

export async function getBilibiliSongUrl(
  trackId: string
): Promise<string | null> {
  const parsed = parseBilibiliTrackId(trackId);
  if (!parsed) return null;

  // Web端：返回代理URL，浏览器原生流式播放
  if (!IS_NATIVE) {
    return getBilibiliSongUrlWeb(parsed.bvid);
  }

  // Android端：使用本地代理
  return getBilibiliSongUrlNative(parsed.bvid);
}
