import { CapacitorHttp } from "@capacitor/core";
import { IS_NATIVE } from "@/lib/api/config";

export interface QqUserProfile {
  uin: string;
  nickname: string;
  avatarUrl: string;
  isVip: boolean;
}

export function normalizeQqCookie(cookie: string): string {
  return cookie.trim().replace(/^Cookie:\s*/i, "");
}

interface QqUserInfoResponse {
  base?: {
    data?: {
      map_userinfo?: Record<string, { nick?: string; headurl?: string }>;
    };
  };
  vip?: {
    data?: {
      map_vipinfo?: Record<string, Record<string, unknown>>;
    };
  };
}

export function getQqUinFromCookie(cookie: string): string | null {
  const values = new Map(
    normalizeQqCookie(cookie)
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([name, value]) => name && value)
      .map(([name, ...value]) => [name, value.join("=")])
  );

  const uin = values.get("uin");
  if (uin) return uin;

  const wxuin = values.get("wxuin");
  if (!wxuin) return null;
  return wxuin.startsWith("o") ? `1${wxuin.slice(1)}` : wxuin;
}

function parseResponse(data: unknown): QqUserInfoResponse {
  if (typeof data !== "string") return data as QqUserInfoResponse;
  return JSON.parse(data) as QqUserInfoResponse;
}

function isVipUser(value: Record<string, unknown> | undefined): boolean {
  if (!value) return false;
  return ["is_vip", "isVip", "vip_type", "viptype", "svip"].some(
    (key) => value[key] === true || Number(value[key]) > 0
  );
}

export async function getQqUserByCookie(
  cookie: string
): Promise<QqUserProfile | null> {
  const isWebDev = !IS_NATIVE && import.meta.env.DEV;
  if (!IS_NATIVE && !isWebDev) return null;
  const trimmedCookie = normalizeQqCookie(cookie);
  const uin = getQqUinFromCookie(trimmedCookie);
  if (!trimmedCookie || !uin) return null;

  const payload = {
    comm: { ct: 24, cv: 0 },
    vip: {
      module: "userInfo.VipQueryServer",
      method: "SRFVipQuery_V2",
      param: { uin_list: [uin] },
    },
    base: {
      module: "userInfo.BaseUserInfoServer",
      method: "get_user_baseinfo_v2",
      param: { vec_uin: [uin] },
    },
  };
  const url =
    "https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&loginUin=" +
    encodeURIComponent(uin) +
    "&hostUin=0&inCharset=utf8&outCharset=utf-8&platform=yqq.json&needNewCode=0&data=" +
    encodeURIComponent(JSON.stringify(payload));

  if (isWebDev) {
    const response = await fetch(
      url.replace("https://u.y.qq.com", "/api/qqmusic-search"),
      { headers: { "X-Real-Cookie": trimmedCookie } }
    );
    if (response.status >= 400) return null;
    const data = parseResponse(await response.json());
    return buildQqUserProfile(data, uin);
  }

  const response = await CapacitorHttp.request({
    method: "GET",
    url,
    headers: { Cookie: trimmedCookie, Referer: "https://y.qq.com/" },
  });
  if (response.status >= 400) return null;

  const data = parseResponse(response.data);
  return buildQqUserProfile(data, uin);
}

function buildQqUserProfile(
  data: QqUserInfoResponse,
  uin: string
): QqUserProfile | null {
  const info = data.base?.data?.map_userinfo?.[uin];
  if (!info?.nick) return null;

  return {
    uin,
    nickname: info.nick,
    avatarUrl: info.headurl || "",
    isVip: isVipUser(data.vip?.data?.map_vipinfo?.[uin]),
  };
}
