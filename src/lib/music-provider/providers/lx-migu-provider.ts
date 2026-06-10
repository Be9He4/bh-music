import { MiguApiProvider } from "./migu-api-provider";
import { MusicTrack, SearchIntent, SearchPageResult } from "@/types/music";
import { getLxUrl } from "@/lib/utils/lx-api";
import { parseMiguTrackId } from "@otter-music/shared";

export class LxMiguProvider extends MiguApiProvider {
  source = "lx_migu" as const;

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
        source: "lx_migu" as const,
        id: track.id.replace(/^migu_/, "lx_migu_"),
      })),
    };
  }

  async getUrl(track: MusicTrack, br?: number): Promise<string | null> {
    const parsed = parseMiguTrackId(track.url_id || track.id);
    if (!parsed) return null;
    return getLxUrl(this.source, parsed.contentId || parsed.copyrightId, br);
  }
}
