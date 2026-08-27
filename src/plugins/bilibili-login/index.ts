import { registerPlugin } from "@capacitor/core";

export interface BilibiliLoginPlugin {
  /**
   * 打开 B站 WebView 登录页。登录成功后返回捕获的 Cookie，
   * 用户取消返回 null。
   */
  openLogin(): Promise<{ cookie: string } | null>;
}

export const BilibiliLogin =
  registerPlugin<BilibiliLoginPlugin>("BilibiliLogin");
