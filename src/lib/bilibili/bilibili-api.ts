import {
  fetchWithTimeout,
  getApiUrl,
  IS_NATIVE,
  IS_WEB_PROD,
} from "@/lib/api/config";
import {
  buildBilibiliHeaders,
  buildBilibiliPlayUrlPath,
  buildBilibiliSearchPath,
  buildBilibiliViewPath,
  parseBilibiliSearchResponse,
  parseBilibiliTrackId,
  selectBilibiliAudioUrl,
  selectBilibiliCid,
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
    } catch (e) {
      if (import.meta.env.DEV) {
        logger.error("[bilibili-blob] base64ToBlob failed:", e);
      }
      return null;
    }
  }
  if (import.meta.env.DEV) {
    logger.info("[bilibili-blob] unexpected typeof:", typeof data);
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

export async function getBilibiliCoverUrl(coverUrl: string): Promise<string | null> {
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
    const blob = ensureBlob(res.data, res.headers?.["Content-Type"] || "image/jpeg");
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
    const playUrl = await fetchBilibiliJson<BilibiliPlayUrlResponse>(
      buildBilibiliPlayUrlPath(bvid, cid),
      referer
    );
    const audioUrl = playUrl ? selectBilibiliAudioUrl(playUrl) : null;
    if (!audioUrl) return null;
    return buildBilibiliAudioProxyUrl(bvid, audioUrl);
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
    const { getNativeBilibiliStreamUrl } = await import("./bilibili-native-player");
    const referer = `https://www.bilibili.com/video/${bvid}`;

    // 获取B站音频URL
    const view = await fetchBilibiliJson<BilibiliViewResponse>(
      buildBilibiliViewPath(bvid),
      referer
    );
    if (!view) return null;

    const cid = selectBilibiliCid(view);
    if (!cid) return null;

    const playUrl = await fetchBilibiliJson<BilibiliPlayUrlResponse>(
      buildBilibiliPlayUrlPath(bvid, cid),
      referer
    );
    const audioUrl = playUrl ? selectBilibiliAudioUrl(playUrl) : null;
    if (!audioUrl) return null;

    // 使用本地代理实现流式播放
    return getNativeBilibiliStreamUrl(audioUrl, bvid);
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
