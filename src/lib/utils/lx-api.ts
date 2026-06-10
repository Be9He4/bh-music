import { IS_NATIVE, IS_WEB_PROD, getApiUrl } from "@/lib/api/config";

// https://github.com/Huibq/keep-alive
const LX_API_BASE = "https://lxmusicapi.onrender.com";
const LX_PROXY_PREFIX = "/music-api/lx";
const LX_API_KEY = "share-v3";

export const LX_SOURCE_CODE: Record<string, string> = {
  lx_netease: "wy",
  lx_qq: "tx",
  lx_migu: "mg",
  lx_kuwo: "kw",
  lx_kugou: "kg",
};

const QUALITY_MAP: Record<number, string> = {
  128: "128k",
  192: "320k",
  320: "320k",
};

function mapBrToQuality(br?: number): string {
  if (!br) return "320k";
  return QUALITY_MAP[br] || (br <= 128 ? "128k" : "320k");
}

export async function getLxUrl(
  source: string,
  songid: string,
  br?: number
): Promise<string | null> {
  const sourceCode = LX_SOURCE_CODE[source];
  if (!sourceCode) return null;
  if (!songid) return null;

  const quality = mapBrToQuality(br);

  if (IS_WEB_PROD) {
    const apiUrl = getApiUrl();
    const res = await fetchWithTimeout(`${apiUrl}${LX_PROXY_PREFIX}/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: sourceCode, songid, quality }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data.url || null;
  }

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

  // dev
  try {
    const res = await fetchWithTimeout(
      `/api/lx-url/url/${sourceCode}/${songid}/${quality}`,
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
