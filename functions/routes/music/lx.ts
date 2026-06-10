import { Hono } from "hono";
import type { Env } from "../../types/hono";

const LX_API_BASE = "https://lxmusicapi.onrender.com";
const LX_API_KEY = "share-v3";

const VALID_SOURCES = new Set(["wy", "tx", "mg", "kw", "kg"]);

export const lxRoutes = new Hono<{ Bindings: Env }>();

lxRoutes.post("/proxy", async (c) => {
  const body = await c.req.json<{
    source: string;
    songid: string;
    quality: string;
  }>();

  if (!body.source || !body.songid) {
    return c.json({ error: "source and songid required" }, 400);
  }

  if (!VALID_SOURCES.has(body.source)) {
    return c.json({ error: `unsupported source: ${body.source}` }, 400);
  }

  const quality = body.quality || "320k";

  try {
    const res = await fetch(
      `${LX_API_BASE}/url/${body.source}/${body.songid}/${quality}`,
      { headers: { "X-Request-Key": LX_API_KEY } }
    );
    if (!res.ok) return c.json({});
    return c.json(await res.json());
  } catch (e: any) {
    console.error("LX Music proxy error:", e);
    return c.json({ error: e.message || "Internal error" }, 500);
  }
});
