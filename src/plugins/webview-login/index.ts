import { registerPlugin } from "@capacitor/core";

interface WebViewLoginPluginInterface {
  /**
   * 打开全屏 WebView 加载登录页，轮询 CookieManager 直到出现
   * successKey 对应的 Cookie，返回 cookieUrls 域下合并的完整 Cookie。
   * 用户取消返回 null。
   */
  openLogin(options: {
    url: string;
    cookieUrls: string[];
    successKey: string;
    /** 可选自定义 UA（如桌面 Chrome），避免站点按移动端重定向 */
    userAgent?: string;
  }): Promise<{ cookie: string } | null>;
  /** 清空全局 CookieManager 中的残留 Cookie，用于退出登录 */
  clearCookies(): Promise<void>;
}

const WebViewLogin = registerPlugin<WebViewLoginPluginInterface>("WebViewLogin");

/** B 站 WebView 登录，成功后返回捕获的 Cookie */
export function openBilibiliLogin(): Promise<{ cookie: string } | null> {
  return WebViewLogin.openLogin({
    url: "https://passport.bilibili.com/login",
    cookieUrls: [
      "https://www.bilibili.com/",
      "https://passport.bilibili.com/",
      "https://bilibili.com/",
    ],
    successKey: "SESSDATA",
  });
}

/** 清空全局 CookieManager，退出登录时调用 */
export function clearBilibiliCookies(): Promise<void> {
  return WebViewLogin.clearCookies();
}

/** 桌面版 Chrome UA，避免 y.qq.com 重定向到无登录入口的移动站 */
const DESKTOP_CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** QQ 音乐 WebView 登录，成功后返回捕获的 Cookie */
export function openQqLogin(): Promise<{ cookie: string } | null> {
  return WebViewLogin.openLogin({
    url: "https://y.qq.com/",
    cookieUrls: ["https://y.qq.com/", "https://qq.com/"],
    successKey: "qm_keyst",
    userAgent: DESKTOP_CHROME_UA,
  });
}
