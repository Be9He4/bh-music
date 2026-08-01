import type { AlistServer, AlistFsItem } from "@/types/alist";
import { fetchWithTimeout } from "@/lib/api/config";
import { cachedFetch } from "@/lib/utils/cache";
import { logger } from "@/lib/logger";

/** 支持的音频扩展名 */
const AUDIO_EXT = [
  ".mp3",
  ".flac",
  ".wav",
  ".m4a",
  ".aac",
  ".ogg",
  ".opus",
  ".wma",
];

/** 判断文件名是否为音频文件 */
export const isAudioFile = (name: string): boolean =>
  AUDIO_EXT.some((ext) => name.toLowerCase().endsWith(ext));

/** 拼接 Alist 完整路径：parent + name（parent 缺失时视为根目录） */
export function joinPath(parent: string | undefined, name: string): string {
  const p = parent && parent !== "/" ? parent.replace(/\/+$/, "") : "";
  return p ? `${p}/${name}` : `/${name}`;
}

/** 规范化站点地址：去尾斜杠 */
const normalizeServerUrl = (url: string) => url.replace(/\/+$/, "");

/** Alist 统一响应格式 */
interface AlistResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** Alist 目录列表 data 结构 */
interface AlistListData {
  content: AlistFsItem[] | null;
  total: number;
}

/** Alist 文件信息 data 结构 */
interface AlistGetData {
  raw_url: string;
}

/**
 * 统一 Alist POST 请求
 * @param server 站点配置
 * @param endpoint 接口路径，如 /api/fs/list
 * @param body 请求体
 */
async function alistPost<T>(
  server: AlistServer,
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  const url = `${normalizeServerUrl(server.serverUrl)}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (server.token) {
    headers["Authorization"] = server.token;
  }

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(
      `Alist HTTP ${res.status}: ${await res.text().catch(() => "")}`
    );
  }

  const json = (await res.json()) as AlistResponse<T>;
  if (json.code !== 200) {
    throw new Error(`Alist ${json.code}: ${json.message}`);
  }
  return json.data;
}

/**
 * 获取目录列表
 * @param server 站点配置
 * @param path 目录路径
 * @param page 页码，默认 1
 * @param per_page 每页数量，0 表示全部
 */
export async function listDir(
  server: AlistServer,
  path: string,
  page: number = 1,
  per_page: number = 0
): Promise<AlistFsItem[]> {
  // v2: 修复 list 响应缺失 parent 的旧缓存
  const cacheKey = `alist:list:v2:${server.id}:${path}:${page}:${per_page}`;
  const result = await cachedFetch<AlistFsItem[]>(
    cacheKey,
    async () => {
      const data = await alistPost<AlistListData>(server, "/api/fs/list", {
        path,
        password: server.token || "",
        page,
        per_page,
        refresh: false,
      });
      // Alist v3 /api/fs/list 的 content 项不含 parent 字段，
      // 同一请求下的所有项父目录即请求的 path，此处统一补齐
      return (data.content ?? []).map((item) => ({
        ...item,
        parent: item.parent ?? path,
      }));
    },
    5 * 60 * 1000
  );
  return result ?? [];
}

/**
 * 搜索文件
 * @param server 站点配置
 * @param keywords 关键词
 * @param scope 0=全部 1=文件夹 2=文件
 * @param page 页码
 * @param per_page 每页数量
 * @param parent 搜索根目录，默认 "/" 即整站递归
 */
export async function searchFiles(
  server: AlistServer,
  keywords: string,
  scope: 0 | 1 | 2 = 2,
  page: number = 1,
  per_page: number = 20,
  parent: string = "/"
): Promise<AlistFsItem[]> {
  try {
    const data = await alistPost<AlistListData>(server, "/api/fs/search", {
      parent,
      keywords,
      scope,
      page,
      per_page,
      password: "",
    });
    return data.content ?? [];
  } catch (e) {
    logger.warn(
      "alist",
      "searchFiles failed",
      e instanceof Error ? e.message : String(e)
    );
    return [];
  }
}

/** Alist track.id 前缀 */
const ALIST_ID_PREFIX = "alist:";

/**
 * 解析 Alist track.id 为 { serverId, filePath }
 * id 格式：alist:<serverId>:<fullPath>
 * 解析失败返回 null。
 */
export function parseAlistTrackId(
  id: string
): { serverId: string; filePath: string } | null {
  if (!id.startsWith(ALIST_ID_PREFIX)) return null;
  const rest = id.slice(ALIST_ID_PREFIX.length);
  const colonIdx = rest.indexOf(":");
  if (colonIdx === -1) return null;
  return {
    serverId: rest.slice(0, colonIdx),
    filePath: rest.slice(colonIdx + 1),
  };
}

/**
 * 获取文件直链（raw_url）用于播放
 * @param server 站点配置
 * @param filePath 文件完整路径
 */
export async function getRawUrl(
  server: AlistServer,
  filePath: string
): Promise<string | null> {
  try {
    const data = await alistPost<AlistGetData>(server, "/api/fs/get", {
      path: filePath,
      password: server.token || "",
    });
    return data.raw_url || null;
  } catch (e) {
    logger.error(
      "alist",
      "getRawUrl failed",
      e instanceof Error ? e.message : String(e),
      { serverId: server.id, filePath }
    );
    return null;
  }
}
