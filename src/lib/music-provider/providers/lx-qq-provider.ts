import { QqApiProvider } from "./qq-api-provider";
import {
  MusicTrack,
  SearchPageResult,
  SearchIntent,
  type MusicSource,
} from "@otter-music/shared";
import { getLxUrl } from "@/lib/utils/lx-api";

/** 洛雪版 QQ 音源：搜索复用 vkey 直连，URL 走 LX API */
export class LxQqProvider extends QqApiProvider {
  source: MusicSource = "lx_qq";

  async search(
    query: string,
    page: number,
    count: number,
    signal?: AbortSignal,
    intent?: SearchIntent | null
  ): Promise<SearchPageResult<MusicTrack>> {
    const result = await super.search(query, page, count, signal, intent);
    return {
      ...result,
      items: result.items.map((track) => ({
        ...track,
        source: "lx_qq" as const,
      })),
    };
  }

  async getUrl(track: MusicTrack, br?: number): Promise<string | null> {
    let songid = track.url_id || track.lyric_id;
    if (!songid) return null;
    if (songid.startsWith("qq_")) songid = songid.slice(3);
    return getLxUrl("lx_qq", songid, br);
  }
}
