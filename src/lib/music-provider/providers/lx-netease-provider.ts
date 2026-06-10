import { NeteaseApiProvider } from "./netease-api-provider";
import { MusicTrack, SearchIntent, SearchPageResult } from "@/types/music";
import { getLxUrl } from "@/lib/utils/lx-api";

export class LxNeteaseProvider extends NeteaseApiProvider {
  source = "lx_netease" as const;

  async search(
    query: string,
    page: number,
    count: number,
    signal?: AbortSignal,
    intent?: SearchIntent | null
  ): Promise<SearchPageResult<MusicTrack>> {
    const result = await super.search(
      query,
      page,
      count,
      signal,
      intent ?? undefined
    );
    return {
      ...result,
      items: result.items.map((track) => ({
        ...track,
        source: "lx_netease" as const,
        // id: `lx_netease_${track.id}`,
      })),
    };
  }

  async getUrl(track: MusicTrack, br?: number): Promise<string | null> {
    return getLxUrl(this.source, track.url_id || track.id, br);
  }
}
