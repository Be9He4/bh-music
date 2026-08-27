import { CapacitorHttp } from "@capacitor/core";
import { buildBilibiliHeaders } from "@otter-music/shared";
import type { BilibiliUserProfile } from "@/store/bilibili-store";

export function normalizeBilibiliCookie(cookie: string): string {
  return cookie.trim().replace(/^Cookie:\s*/i, "");
}

interface BilibiliNavData {
  isLogin: boolean;
  mid?: number;
  uname?: string;
  face?: string;
}

interface BilibiliNavResponse {
  code?: number;
  message?: string;
  data?: BilibiliNavData;
}

/**
 * 通过 B 站 nav 接口验证 Cookie 登录态并返回用户信息。
 */
export async function getBilibiliUserByCookie(
  cookie: string
): Promise<BilibiliUserProfile | null> {
  const value = normalizeBilibiliCookie(cookie);
  if (!value) return null;

  try {
    const res = await CapacitorHttp.request({
      method: "GET",
      url: "https://api.bilibili.com/x/web-interface/nav",
      headers: { ...buildBilibiliHeaders(), Cookie: value },
    });
    if (res.status >= 400) return null;

    const data = (
      typeof res.data === "string" ? JSON.parse(res.data) : res.data
    ) as BilibiliNavResponse;
    const nav = data.data;
    if (!nav?.isLogin || !nav.mid) return null;

    return { mid: nav.mid, uname: nav.uname || "", face: nav.face || "" };
  } catch {
    return null;
  }
}
