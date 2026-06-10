import { QqApiProvider } from "./qq-api-provider";
import { MusicTrack, SearchIntent, SearchPageResult } from "@/types/music";

export class LxQqProvider extends QqApiProvider {
  source = "lx_qq" as const;

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
        source: "lx_qq" as const,
        // id: track.id.replace(/^qq_/, "lx_qq_"),
      })),
    };
  }
}
