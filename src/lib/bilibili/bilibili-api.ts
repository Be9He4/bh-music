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
import { logger } from "../logger";

const BILIBILI_API_BASE = "https://api.bilibili.com";
const BILIBILI_PROXY_PREFIX = "/music-api/bilibili";
const BILIBILI_DEV_AUDIO_PROXY = "/api/bilibili-audio";
const BILIBILI_DEV_COVER_PROXY = "/api/bilibili-cover";
const NETWORK_TIMEOUT = 12000;

function base64ToBlob(base64: string, mimeType: string): Blob {
  // Android Base64.DEFAULT inserts \r\n every 76 chars — strip before atob()
  const cleaned = base64.replace(/[\s\r\n]+/g, "");
  const binaryStr = atob(cleaned);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes.buffer], { type: mimeType });
}

function ensureBlob(data: unknown, mimeType: string): Blob | null {
  if (data instanceof Blob) return data;
  if (typeof data === "string") {
    let base64 = data;
    if (data.startsWith("data:")) {
      const commaIdx = data.indexOf(",");
      base64 = commaIdx >= 0 ? data.substring(commaIdx + 1) : data;
    }
    logger.info("bilibili-blob] typeof=data:string, len=" + data.length +
      ", hasNewlines=" + /[\r\n]/.test(data) +
      ", first80=" + JSON.stringify(data.substring(0, 80)));
    try {
      const blob = base64ToBlob(base64, mimeType);
      logger.info("bilibili-blob] blob created, size=" + blob.size);
      return blob;
    } catch (e) {
      logger.error("bilibili-blob] base64ToBlob failed:", e);
      return null;
    }
  }
  logger.info("bilibili-blob] unexpected typeof:", typeof data);
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

export async function getBilibiliSongUrl(
  trackId: string
): Promise<string | null> {
  const parsed = parseBilibiliTrackId(trackId);
  if (!parsed) return null;

  if (IS_WEB_PROD) {
    const res = await fetchWithTimeout(
      `${getApiUrl()}${BILIBILI_PROXY_PREFIX}/song-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bvid: parsed.bvid }),
      },
      NETWORK_TIMEOUT
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string | null };
    return data.url || null;
  }

  try {
    const referer = `https://www.bilibili.com/video/${parsed.bvid}`;
    const view = await fetchBilibiliJson<BilibiliViewResponse>(
      buildBilibiliViewPath(parsed.bvid),
      referer
    );
    if (!view) return null;

    const cid = selectBilibiliCid(view);
    if (!cid) return null;

    const playUrl = await fetchBilibiliJson<BilibiliPlayUrlResponse>(
      buildBilibiliPlayUrlPath(parsed.bvid, cid),
      referer
    );
    const audioUrl = playUrl ? selectBilibiliAudioUrl(playUrl) : null;
    if (!audioUrl) return null;
    if (IS_NATIVE) {
      const { CapacitorHttp } = await import("@capacitor/core");
      const res = await CapacitorHttp.request({
        method: "GET",
        url: audioUrl,
        headers: buildBilibiliHeaders(referer),
        responseType: "blob",
      });
      if (res.status >= 400) return null;
      const blob = ensureBlob(res.data, res.headers?.["Content-Type"] || "audio/mp4");
      if (!blob) return null;
      const blobUrl = URL.createObjectURL(blob);
      registerBlobUrl(blobUrl);
      return blobUrl;
    }
    return buildBilibiliAudioProxyUrl(parsed.bvid, audioUrl);
  } catch {
    return null;
  }
}
