import { getApiUrl, getProxyUrl, isProxyUrl } from "@/lib/api/config";

/**
 * 判断 URL 是否指向 localhost / 127.0.0.1
 */
export function isLocalhostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * 从代理 URL 中提取被代理的原始音频 URL。
 * 不是代理 URL 时原样返回。
 */
function extractOriginalAudioUrl(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    if (u.pathname === "/proxy") {
      const original = u.searchParams.get("url");
      if (original) return original;
    }
  } catch {
    // 非法 URL 时原样返回
  }
  return url;
}

/**
 * 判断 URL 是否是当前后端的代理 URL
 */
function isCurrentBackendProxyUrl(url: string): boolean {
  try {
    const u = new URL(url, window.location.origin);
    const apiHost = new URL(getApiUrl()).host;
    return u.host === apiHost && u.pathname === "/proxy";
  } catch {
    return false;
  }
}

/**
 * 把音频 URL 转换为适合当前页面播放的形式：
 * - http:// 原始 URL → localhost 直连，其余走 getProxyUrl 包装
 * - 当前后端的代理 URL → 原样返回（保留 bvid 等额外参数）
 * - 旧后端的代理 URL → 提取原始 URL 后用当前后端重新包装
 * - 其他（https 直连、blob:、capacitor:）→ 原样返回
 */
export function normalizeAudioUrlForPlayback(url: string): string {
  if (url.startsWith("http://")) {
    if (isLocalhostUrl(url)) return url;
    return getProxyUrl(url);
  }

  // 当前后端的代理 URL，原样返回（保留 bvid 等额外参数）
  if (isCurrentBackendProxyUrl(url)) return url;

  // 旧后端的代理 URL，提取原始 URL 后用当前后端重新包装
  if (isProxyUrl(url)) {
    return getProxyUrl(extractOriginalAudioUrl(url));
  }

  return url;
}
