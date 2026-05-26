import {
  buildMiguSearchHeaders,
  buildMiguSearchPath,
  buildMiguSongUrlPath,
  convertMiguSearchSongToMusicTrack,
  convertMiguSongToMusicTrack,
  fetchMiguPlaylistDetail,
  generateMiguSid,
  MIGU_PAGE_SIZE,
  parseMiguSongUrlResponse,
  type MiguPlaylistDetail,
  type MiguSearchResponse,
  type MiguSongUrlResponse,
  type MusicTrack,
} from "@otter-music/shared";

export { MIGU_PAGE_SIZE, convertMiguSongToMusicTrack };

const MIGU_BASE_URL = "https://app.c.nf.migu.cn";
const MIGU_SEARCH_BASE_URL = "https://jadeite.migu.cn";
const MIGU_SHORT_LINK_HOST = "c.migu.cn";
const MIGU_SHARE_PAGE_HOST = "h5.nf.migu.cn";
const MIGU_SHARE_PLAYLIST_PATH = "/app/v4/p/share/playlist/index.html";

// ============================================================
// 短链解析
// ============================================================

export function isMiguPlaylistShortLink(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    return url.protocol === "https:" && url.hostname === MIGU_SHORT_LINK_HOST;
  } catch {
    return false;
  }
}

export function parseMiguShareRedirectPlaylistId(
  urlStr: string
): string | null {
  try {
    const url = new URL(urlStr);
    if (
      url.protocol !== "https:" ||
      url.hostname !== MIGU_SHARE_PAGE_HOST ||
      url.pathname !== MIGU_SHARE_PLAYLIST_PATH
    ) {
      return null;
    }
    const playlistId = url.searchParams.get("id");
    return playlistId && /^\d+$/.test(playlistId) ? playlistId : null;
  } catch {
    return null;
  }
}

export async function resolveMiguShortPlaylistId(
  urlStr: string,
  fetcher: typeof fetch = fetch
): Promise<string | null> {
  if (!isMiguPlaylistShortLink(urlStr)) return null;

  const response = await fetcher(urlStr, {
    method: "GET",
    redirect: "manual",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  const redirectUrl = response.headers.get("Location") || response.url;
  return parseMiguShareRedirectPlaylistId(redirectUrl);
}

// ============================================================
// 歌单获取（直接 fetch + 调用 shared 核心算法）
// ============================================================

async function fetchMiguJson<T>(
  path: string,
  headers: Record<string, string> = {}
): Promise<T> {
  const res = await fetch(`${MIGU_BASE_URL}${path}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`Migu API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchMiguPlaylistDetail(
  playlistId: string
): Promise<MiguPlaylistDetail> {
  const fetchText = async (path: string) => {
    const data = await fetchMiguJson<unknown>(path);
    return JSON.stringify(data);
  };
  return fetchMiguPlaylistDetail(playlistId, fetchText);
}

// ============================================================
// 播放地址获取
// ============================================================

export async function fetchMiguSongUrl(
  copyrightId: string,
  contentId: string,
  br = 192
): Promise<string | null> {
  const response = await fetchMiguJson<MiguSongUrlResponse>(
    buildMiguSongUrlPath(copyrightId, contentId, br),
    {
      channel: "0146951",
      uid: "1234",
    }
  );
  return parseMiguSongUrlResponse(response);
}

// ============================================================
// 搜索
// ============================================================

export async function fetchMiguSearch(
  keyword: string,
  page: number,
  rows = 20
): Promise<{ items: MusicTrack[]; hasMore: boolean }> {
  const sid = generateMiguSid();
  const path = buildMiguSearchPath(keyword, page, rows, sid);
  const res = await fetch(`${MIGU_SEARCH_BASE_URL}${path}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ...buildMiguSearchHeaders(keyword),
    },
  });
  if (!res.ok) return { items: [], hasMore: false };

  const data = (await res.json()) as unknown as MiguSearchResponse;
  const result = data?.songResultData?.result;
  if (!result?.length) return { items: [], hasMore: false };

  const total = Number(data?.songResultData?.totalCount) || 0;
  return {
    items: result.map(convertMiguSearchSongToMusicTrack),
    hasMore: total > 0 ? page * rows < total : result.length >= rows,
  };
}
