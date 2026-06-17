import { getProxyUrl, isProxyUrl } from "@/lib/api/config";

/**
 * 从代理 URL 中提取被代理的原始音频 URL。
 * 不是代理 URL 时原样返回。
 */
export function extractOriginalAudioUrl(url: string): string {
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
 * 把音频 URL 转换为适合当前页面播放的形式：
 * - http:// 原始 URL → 当前 getProxyUrl 包装
 * - 旧的 https://xxx/proxy?url=... → 提取原始 URL 后用当前 getProxyUrl 重新包装
 * - 其他（https 直连、blob:、capacitor:）→ 原样返回
 */
export function normalizeAudioUrlForPlayback(url: string): string {
  if (url.startsWith("http://")) {
    return getProxyUrl(url);
  }

  if (isProxyUrl(url)) {
    return getProxyUrl(extractOriginalAudioUrl(url));
  }

  return url;
}
