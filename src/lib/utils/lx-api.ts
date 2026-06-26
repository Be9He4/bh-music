import { IS_NATIVE, IS_WEB_PROD, getProxyUrl } from "@/lib/api/config";

/** 洛雪 API 基地址 */
const LX_API_BASE = "https://lxmusicapi.onrender.com";
const LX_API_KEY = "share-v3";

/** 音源 ID → LX API 源码标识 */
export const LX_SOURCE_CODE: Record<string, string> = {
  lx_kuwo: "kw",
  lx_qq: "tx",
};

/** LX API 仅支持 128k / 320k 两档音质，超过 320 视为 320k，低于 128 视为 128k */
function mapBrToQuality(br?: number): string {
  if (!br) return "320k";
  return br <= 128 ? "128k" : "320k";
}

async function tryFetchLxUrl(
  sourceCode: string,
  songid: string,
  quality: string
): Promise<string | null> {
  const url = `${LX_API_BASE}/url/${sourceCode}/${songid}/${quality}`;

  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      method: "GET",
      url,
      headers: { "X-Request-Key": LX_API_KEY },
    });
    if (res.status >= 400) return null;
    const data = (
      typeof res.data === "string" ? JSON.parse(res.data) : res.data
    ) as { url?: string };
    return data.url || null;
  }

  try {
    const headers: Record<string, string> = { "X-Request-Key": LX_API_KEY };
    const isDev = !IS_NATIVE && import.meta.env.DEV;

    let fetchUrl: string;
    let fetchInit: RequestInit;

    if (IS_WEB_PROD) {
      fetchUrl = `${getProxyUrl(url)}&headers=${encodeURIComponent(JSON.stringify(headers))}`;
      fetchInit = {};
    } else if (isDev) {
      fetchUrl = `/api/lx/url/${sourceCode}/${songid}/${quality}`;
      fetchInit = { headers };
    } else {
      fetchUrl = url;
      fetchInit = { headers };
    }

    const res = await fetchWithTimeout(fetchUrl, fetchInit);
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data.url || null;
  } catch {
    return null;
  }
}

/**
 * 通过洛雪 API 获取播放 URL
 * @param source 音源 ID（lx_kuwo / lx_qq）
 * @param songid 歌曲 ID
 * @param br 比特率
 *
 * 内部自动降级：请求音质失败时尝试 128k
 */
export async function getLxUrl(
  source: string,
  songid: string,
  br?: number
): Promise<string | null> {
  const sourceCode = LX_SOURCE_CODE[source];
  if (!sourceCode || !songid) return null;

  const quality = mapBrToQuality(br);

  let result = await tryFetchLxUrl(sourceCode, songid, quality);
  if (result) return result;

  if (quality !== "128k") {
    result = await tryFetchLxUrl(sourceCode, songid, "128k");
  }

  return result;
}

const NETWORK_TIMEOUT = 12000;

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
