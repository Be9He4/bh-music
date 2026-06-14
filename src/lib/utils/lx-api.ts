import { IS_NATIVE } from "@/lib/api/config";

/** 洛雪 API 基地址 */
const LX_API_BASE = "https://lxmusicapi.onrender.com";
const LX_API_KEY = "share-v3";

/** 音源 ID → LX API 源码标识 */
export const LX_SOURCE_CODE: Record<string, string> = {
  lx_kuwo: "kw",
  lx_qq: "tx",
};

/** 比特率 → LX API 音质参数 */
const QUALITY_MAP: Record<number, string> = {
  128: "128k",
  192: "320k",
  320: "320k",
};

function mapBrToQuality(br?: number): string {
  if (!br) return "320k";
  return QUALITY_MAP[br] || (br <= 128 ? "128k" : "320k");
}

/**
 * 通过洛雪 API 获取播放 URL
 * @param source 音源 ID（lx_kuwo / lx_qq）
 * @param songid 歌曲 ID
 * @param br 比特率
 */
export async function getLxUrl(
  source: string,
  songid: string,
  br?: number
): Promise<string | null> {
  const sourceCode = LX_SOURCE_CODE[source];
  if (!sourceCode || !songid) return null;

  const quality = mapBrToQuality(br);

  // 原生端：CapacitorHttp 直连，带 API Key header
  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      method: "GET",
      url: `${LX_API_BASE}/url/${sourceCode}/${songid}/${quality}`,
      headers: { "X-Request-Key": LX_API_KEY },
    });
    if (res.status >= 400) return null;
    const data =
      typeof res.data === "string"
        ? (JSON.parse(res.data) as { url?: string })
        : (res.data as { url?: string });
    return data.url || null;
  }

  // Web 端：fetch 直连
  try {
    const res = await fetchWithTimeout(
      `${LX_API_BASE}/url/${sourceCode}/${songid}/${quality}`,
      { headers: { "X-Request-Key": LX_API_KEY } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data.url || null;
  } catch {
    return null;
  }
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
