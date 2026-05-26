import {
  fetchWithTimeout,
  getApiUrl,
  getProxyUrl,
  IS_NATIVE,
  IS_WEB_PROD,
} from "@/lib/api/config";
import {
  buildMiguHeaders,
  buildMiguSongUrlPath,
  buildMiguV3SearchPath,
  convertMiguSongToMusicTrack,
  convertMiguV3SearchSongToMusicTrack,
  fetchMiguPlaylistDetail,
  forceHttps,
  MIGU_PAGE_SIZE,
  parseMiguSongUrlResponse,
  parseMiguTrackId,
  type MiguPlaylistDetail,
  type MiguV3SearchSongRaw,
  type MusicTrack,
  type MiguSongUrlResponse,
} from "@otter-music/shared";

const MIGU_PROXY_PREFIX = "/music-api/migu";
const NETWORK_TIMEOUT = 12000;

export { convertMiguSongToMusicTrack, MIGU_PAGE_SIZE };

// ============================================================
// URL 解析（前端特有逻辑）
// ============================================================

export function parseMiguPlaylistUrl(urlStr: string): string | null {
  try {
    const normalized = urlStr.replace(
      "music.migu.cn/v3/my/playlist/",
      "music.migu.cn/v3/music/playlist/"
    );
    const url = new URL(
      normalized.startsWith("http") ? normalized : `https://${normalized}`
    );
    const pathMatch = url.pathname.match(/\/v3\/music\/playlist\/(\d+)/);
    if (pathMatch) return pathMatch[1];

    const idParam =
      url.searchParams.get("playlistId") ||
      url.searchParams.get("musicListId") ||
      url.searchParams.get("id");
    return idParam && /^\d+$/.test(idParam) ? idParam : null;
  } catch {
    return null;
  }
}

export async function resolveMiguPlaylistId(
  urlStr: string
): Promise<string | null> {
  const directId = parseMiguPlaylistUrl(urlStr);
  if (directId) return directId;

  try {
    const url = new URL(urlStr);
    if (url.protocol !== "https:" || url.hostname !== "c.migu.cn") return null;

    const endpoint =
      !IS_WEB_PROD && !IS_NATIVE
        ? "/api/migu-resolve"
        : `${getApiUrl()}${MIGU_PROXY_PREFIX}/resolve-playlist`;

    const res = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.toString() }),
      },
      NETWORK_TIMEOUT
    );
    if (!res.ok) return null;

    const data = (await res.json()) as { playlistId?: string };
    return data.playlistId && /^\d+$/.test(data.playlistId)
      ? data.playlistId
      : null;
  } catch {
    return null;
  }
}

// ============================================================
// 歌单获取（环境路由 + 调用 shared 核心算法）
// ============================================================

export async function getMiguPlaylistDetail(
  playlistId: string
): Promise<MiguPlaylistDetail> {
  if (IS_WEB_PROD) {
    try {
      const res = await fetchWithTimeout(
        `${getApiUrl()}${MIGU_PROXY_PREFIX}/playlist`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playlistId }),
        },
        NETWORK_TIMEOUT
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error || `API error: ${res.status}`
        );
      }
      return res.json();
    } catch (e) {
      if (e instanceof Error && !e.message.startsWith("API error:")) {
        throw new Error("Migu playlist request timed out");
      }
      throw e;
    }
  }

  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    return fetchMiguPlaylistDetail(playlistId, async (path) => {
      const res = await CapacitorHttp.request({
        method: "GET",
        url: `https://app.c.nf.migu.cn${path}`,
      });
      if (res.status >= 400) throw new Error(`Migu API error: ${res.status}`);
      return typeof res.data === "string" ? res.data : JSON.stringify(res.data);
    });
  }

  return fetchMiguPlaylistDetail(playlistId, async (path) => {
    const res = await fetchWithTimeout(`/api/migu${path}`, {}, NETWORK_TIMEOUT);
    if (!res.ok) throw new Error(`Migu API error: ${res.status}`);
    return res.text();
  });
}

// ============================================================
// 播放地址获取（环境路由）
// ============================================================

export async function getMiguSongUrl(
  trackId: string,
  br = 192
): Promise<string | null> {
  const ids = parseMiguTrackId(trackId);
  if (!ids) return null;

  if (IS_WEB_PROD) {
    try {
      const res = await fetchWithTimeout(
        `${getApiUrl()}${MIGU_PROXY_PREFIX}/song-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            copyrightId: ids.copyrightId,
            contentId: ids.contentId,
            br,
          }),
        },
        NETWORK_TIMEOUT
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { url?: string | null };
      return data.url || null;
    } catch {
      return null;
    }
  }

  const path = buildMiguSongUrlPath(ids.copyrightId, ids.contentId, br);
  const fetchJson = async (): Promise<MiguSongUrlResponse> => {
    if (IS_NATIVE) {
      const { CapacitorHttp } = await import("@capacitor/core");
      const res = await CapacitorHttp.request({
        method: "GET",
        url: `https://app.c.nf.migu.cn${path}`,
        headers: buildMiguHeaders(),
      });
      return typeof res.data === "string" ? JSON.parse(res.data) : res.data;
    }
    const res = await fetchWithTimeout(
      `/api/migu${path}`,
      { headers: buildMiguHeaders() },
      NETWORK_TIMEOUT
    );
    if (!res.ok) return {};
    return res.json();
  };

  try {
    return parseMiguSongUrlResponse(await fetchJson());
  } catch {
    return null;
  }
}

// ============================================================
// 歌词获取（环境路由）
// ============================================================

export async function getMiguLyric(
  lyricUrl: string
): Promise<{ lyric: string; tlyric: string } | null> {
  const normalizedUrl = lyricUrl.startsWith("//")
    ? `https:${lyricUrl}`
    : forceHttps(lyricUrl);
  if (!normalizedUrl.startsWith("http")) return null;

  try {
    if (IS_NATIVE) {
      const { CapacitorHttp } = await import("@capacitor/core");
      const res = await CapacitorHttp.request({
        method: "GET",
        url: normalizedUrl,
      });
      if (res.status >= 400) return null;
      return {
        lyric: typeof res.data === "string" ? res.data : String(res.data),
        tlyric: "",
      };
    }

    const res = await fetchWithTimeout(
      getProxyUrl(normalizedUrl),
      {},
      NETWORK_TIMEOUT
    );
    if (!res.ok) return null;
    return { lyric: await res.text(), tlyric: "" };
  } catch {
    return null;
  }
}

// ============================================================
// 搜索 V3（环境路由）
// ============================================================

export async function searchMiguSongs(
  keyword: string,
  page: number,
  rows = 20
): Promise<{ items: MusicTrack[]; hasMore: boolean }> {
  if (IS_WEB_PROD) {
    const res = await fetchWithTimeout(
      `${getApiUrl()}${MIGU_PROXY_PREFIX}/search`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, page, rows }),
      },
      NETWORK_TIMEOUT
    );
    if (!res.ok) return { items: [], hasMore: false };
    return res.json();
  }

  const path = buildMiguV3SearchPath(keyword, page, rows);
  const headers = buildMiguHeaders();

  if (IS_NATIVE) {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.request({
      method: "GET",
      url: `https://app.u.nf.migu.cn${path}`,
      headers,
    });
    if (res.status >= 400) return { items: [], hasMore: false };
    const data: unknown =
      typeof res.data === "object" ? res.data : JSON.parse(res.data as string);
    return parseAndConvertMiguV3Search(data, rows);
  }

  try {
    const res = await fetchWithTimeout(
      `/api/migu-v3${path}`,
      { headers },
      NETWORK_TIMEOUT
    );
    if (!res.ok) return { items: [], hasMore: false };
    return parseAndConvertMiguV3Search(await res.json(), rows);
  } catch {
    return { items: [], hasMore: false };
  }
}

function parseAndConvertMiguV3Search(
  data: unknown,
  rows: number
): { items: MusicTrack[]; hasMore: boolean } {
  const list = data as MiguV3SearchSongRaw[];
  if (!Array.isArray(list) || !list.length) {
    return { items: [], hasMore: false };
  }

  return {
    items: list.map(convertMiguV3SearchSongToMusicTrack),
    hasMore: list.length >= rows,
  };
}
