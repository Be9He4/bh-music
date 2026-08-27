import { fetchWithTimeout, IS_NATIVE } from "@/lib/api/config";
import { logger } from "@/lib/logger";
import { CapacitorHttp } from "@capacitor/core";

const IS_WEB_DEV = !IS_NATIVE && import.meta.env.MODE === "development";

export interface WebdavConfig {
  url: string;
  username: string;
  password: string;
}

const BACKUP_FILENAME = "otter-music-backup.json";

export const BACKUP_FILE_NAME = BACKUP_FILENAME;

/** 去尾斜杠，兼容用户粘贴的目录 URL */
export function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/** 拼接云端备份文件完整路径 */
export function buildBackupUrl(url: string): string {
  return `${normalizeUrl(url)}/${BACKUP_FILENAME}`;
}

/** UTF-8 安全的 Base64 编码，用于 Basic Auth（用户名/密码可能含非 ASCII 字符） */
export function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function authHeader(cfg: WebdavConfig): string {
  return `Basic ${encodeBase64(`${cfg.username}:${cfg.password}`)}`;
}

/**
 * 统一的 WebDAV 请求。
 * 原生端直连；Web 端直连，若目标服务不允许浏览器跨域则抛出带平台提示的错误。
 */
type WebdavResponse = Pick<Response, "status" | "ok" | "text">;

async function webdavRequest(
  cfg: WebdavConfig,
  method: string,
  path: string,
  init: RequestInit = {}
): Promise<WebdavResponse> {
  const url = `${normalizeUrl(cfg.url)}/${path}`;
  try {
    if (IS_NATIVE) {
      const response = await CapacitorHttp.request({
        method,
        url,
        headers: {
          Authorization: authHeader(cfg),
          ...(init.headers as Record<string, string> | undefined),
        },
        ...(init.body !== undefined ? { data: init.body } : {}),
      });
      const body =
        typeof response.data === "string"
          ? response.data
          : JSON.stringify(response.data ?? "");
      return {
        status: response.status,
        ok: response.status >= 200 && response.status < 300,
        text: async () => body,
      };
    }

    const requestUrl = IS_WEB_DEV
      ? `/api/webdav?url=${encodeURIComponent(url)}`
      : url;

    return await fetchWithTimeout(requestUrl, {
      method,
      headers: { Authorization: authHeader(cfg), ...init.headers },
      body: init.body,
    });
  } catch (e) {
    if (!IS_NATIVE && !IS_WEB_DEV && e instanceof TypeError) {
      logger.error("webdav", "CORS blocked", e, { url });
      throw new Error(
        "当前 WebDAV 服务不支持浏览器跨域访问，请在 Android 端使用"
      );
    }
    throw e;
  }
}

/** 测试连接：校验凭据与目录可达性 */
export async function testConnection(cfg: WebdavConfig): Promise<void> {
  // CapacitorHttp only supports standard HTTP methods; OPTIONS also verifies
  // that the configured WebDAV endpoint is reachable and accepts credentials.
  const res = await webdavRequest(cfg, "OPTIONS", "");
  if (res.status === 401 || res.status === 403) {
    throw new Error("认证失败，请检查用户名和密码");
  }
  if (!res.ok && res.status !== 405) {
    throw new Error(`连接失败，HTTP ${res.status}`);
  }
}

/** 上传备份 JSON 到云端（覆盖同名文件） */
export async function uploadBackup(
  cfg: WebdavConfig,
  json: string
): Promise<void> {
  const res = await webdavRequest(cfg, "PUT", BACKUP_FILENAME, {
    headers: { "Content-Type": "application/json" },
    body: json,
  });
  if (!res.ok) {
    throw new Error(
      `上传失败，HTTP ${res.status}，请检查目标目录是否存在且可写`
    );
  }
}

/** 从云端下载备份 JSON 文本 */
export async function downloadBackup(cfg: WebdavConfig): Promise<string> {
  const res = await webdavRequest(cfg, "GET", BACKUP_FILENAME);
  if (res.status === 401 || res.status === 403) {
    throw new Error("认证失败，请检查用户名和密码");
  }
  if (res.status === 404) {
    throw new Error("云端暂无备份，请先上传");
  }
  if (!res.ok) {
    throw new Error(`下载失败，HTTP ${res.status}`);
  }
  return res.text();
}
