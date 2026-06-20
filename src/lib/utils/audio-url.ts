import { getProxyUrl, isProxyUrl } from "@/lib/api/config";

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
 * 把音频 URL 转换为适合当前页面播放的形式：
 * - http:// 原始 URL → localhost 直连，其余走 getProxyUrl 包装
 * - 代理 URL（/proxy）→ 原样返回（保留 bvid 等额外参数）
 * - 其他（https 直连、blob:、capacitor:）→ 原样返回
 */
export function normalizeAudioUrlForPlayback(url: string): string {
  if (url.startsWith("http://")) {
    if (isLocalhostUrl(url)) return url;
    return getProxyUrl(url);
  }

  // 代理 URL 原样返回（含当前后端和旧后端的代理，保留额外参数）
  if (isProxyUrl(url)) return url;

  return url;
}
