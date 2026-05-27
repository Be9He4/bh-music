import {
  BILIBILI_COVER_HOST_RE,
  buildBilibiliHeaders,
  buildBilibiliPlayUrlPath,
  buildBilibiliSearchPath,
  buildBilibiliViewPath,
  parseBilibiliSearchResponse,
  selectBilibiliAudioUrl,
  selectBilibiliCid,
  type BilibiliPlayUrlResponse,
  type BilibiliSearchResponse,
  type BilibiliViewResponse,
  type MusicTrack,
  type SearchPageResult,
} from "@otter-music/shared";

const BILIBILI_BASE_URL = "https://api.bilibili.com";

async function fetchBilibiliJson<T>(
  path: string,
  referer?: string
): Promise<T> {
  const res = await fetch(`${BILIBILI_BASE_URL}${path}`, {
    headers: buildBilibiliHeaders(referer),
  });
  if (!res.ok) throw new Error(`Bilibili API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchBilibiliSearch(
  keyword: string,
  page: number,
  rows = 20
): Promise<SearchPageResult<MusicTrack>> {
  const data = await fetchBilibiliJson<BilibiliSearchResponse>(
    buildBilibiliSearchPath(keyword, page, rows)
  );
  return parseBilibiliSearchResponse(data, page, rows);
}

export async function fetchBilibiliSongUrl(
  bvid: string
): Promise<string | null> {
  const referer = `https://www.bilibili.com/video/${bvid}`;
  const view = await fetchBilibiliJson<BilibiliViewResponse>(
    buildBilibiliViewPath(bvid),
    referer
  );
  const cid = selectBilibiliCid(view);
  if (!cid) return null;

  const playUrl = await fetchBilibiliJson<BilibiliPlayUrlResponse>(
    buildBilibiliPlayUrlPath(bvid, cid),
    referer
  );
  return selectBilibiliAudioUrl(playUrl);
}

export async function proxyBilibiliAudio(
  bvid: string,
  url: string,
  range?: string | null
): Promise<Response> {
  const headers: Record<string, string> = buildBilibiliHeaders(
    `https://www.bilibili.com/video/${bvid}`
  );
  if (range) headers.Range = range;

  const response = await fetch(url, { headers });

  // 透传关键响应头，确保Range请求正常工作
  const responseHeaders = new Headers();
  const headersToPass = [
    "Content-Type",
    "Content-Length",
    "Content-Range",
    "Accept-Ranges",
    "ETag",
    "Last-Modified",
    "Cache-Control"
  ];

  for (const h of headersToPass) {
    const val = response.headers.get(h);
    if (val) responseHeaders.set(h, val);
  }

  responseHeaders.set("Access-Control-Allow-Origin", "*");
  responseHeaders.set(
    "Access-Control-Expose-Headers",
    "Content-Length, Content-Range, Accept-Ranges, ETag"
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export async function proxyBilibiliCover(url: string): Promise<Response> {
  const parsed = new URL(url);
  if (!BILIBILI_COVER_HOST_RE.test(parsed.hostname)) {
    return new Response(JSON.stringify({ error: "invalid cover host" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const response = await fetch(url, {
    headers: buildBilibiliHeaders("https://www.bilibili.com/"),
  });
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set("Access-Control-Allow-Origin", "*");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
