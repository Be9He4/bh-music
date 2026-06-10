import { Hono } from "hono";
import type { Env } from "../../types/hono";
import {
  fetchKugouPlaylistDetail,
  resolveKugouShortUrl,
} from "../../utils/music/kugou-api";
import {
  getKugouLyric,
  searchKugouMusic,
} from "../../utils/music/kugou-search";

export const kugouRoutes = new Hono<{ Bindings: Env }>();

/**
 * 解析酷狗分享短链。
 */
kugouRoutes.post("/resolve-shortlink", async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  if (!url) return c.json({ error: "url required" }, 400);

  try {
    const resolvedUrl = await resolveKugouShortUrl(url);
    if (!resolvedUrl)
      return c.json({ error: "unable to resolve short link" }, 400);
    return c.json({ resolvedUrl });
  } catch (e: any) {
    console.error("Kugou short URL resolve error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});

/**
 * 获取酷狗公开歌单详情。
 */
kugouRoutes.post("/playlist", async (c) => {
  const { playlistId } = await c.req.json<{ playlistId: string }>();
  if (!playlistId) return c.json({ error: "playlistId required" }, 400);

  try {
    return c.json(await fetchKugouPlaylistDetail(playlistId));
  } catch (e: any) {
    console.error("Kugou API error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});

/**
 * 酷狗音乐搜索。
 */
kugouRoutes.post("/search", async (c) => {
  const {
    query,
    page = 0,
    limit = 20,
  } = await c.req.json<{
    query: string;
    page?: number;
    limit?: number;
  }>();
  if (!query) return c.json({ error: "query required" }, 400);

  try {
    return c.json(await searchKugouMusic(query, page, limit));
  } catch (e: any) {
    console.error("Kugou search error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});

/**
 * 酷狗歌词获取。
 */
kugouRoutes.post("/lyric", async (c) => {
  const { hash } = await c.req.json<{ hash: string }>();
  if (!hash) return c.json({ error: "hash required" }, 400);

  try {
    const lyric = await getKugouLyric(hash);
    return c.json({ lyric });
  } catch (e: any) {
    console.error("Kugou lyric error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});
