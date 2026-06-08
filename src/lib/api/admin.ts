import { getApiUrl, fetchWithTimeout, unwrap } from "./config";

const authUrl = () => `${getApiUrl()}/auth`;
const syncUrl = () => `${getApiUrl()}/sync/v2`;

/** 带 credentials: include 的 fetch，用于管理端 Cookie 认证 */
const adminFetch = (input: RequestInfo | URL, init: RequestInit = {}) =>
  fetchWithTimeout(input, { ...init, credentials: "include" });

export interface SyncKeyItem {
  key: string;
  lastSyncTime: number;
  sizeBytes?: number;
}

/** 登录，成功后后端 Set-Cookie */
export const adminLogin = (password: string) =>
  unwrap<{ token: string }>(
    adminFetch(`${authUrl()}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
  );

/** 登出，后端清除 Cookie */
export const adminLogout = () =>
  unwrap<null>(adminFetch(`${authUrl()}/logout`, { method: "POST" }));

/** 列出所有 Sync Key */
export const adminListKeys = () =>
  unwrap<{ keys: SyncKeyItem[] }>(adminFetch(`${syncUrl()}/keys`));

/** 创建新 Sync Key，prefix 可选 */
export const adminCreateKey = (prefix?: string) =>
  unwrap<{ syncKey: string }>(
    adminFetch(`${syncUrl()}/create-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix: prefix || undefined }),
    })
  );

/** 删除指定 Sync Key */
export const adminDeleteKey = (key: string) =>
  unwrap<null>(
    adminFetch(`${syncUrl()}/keys/${encodeURIComponent(key)}`, {
      method: "DELETE",
    })
  );
