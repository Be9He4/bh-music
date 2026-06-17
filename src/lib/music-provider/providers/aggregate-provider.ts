import { IMusicProvider } from "../interface";
import {
  MusicSource,
  MusicTrack,
  SearchPageResult,
  SongLyric,
  SearchIntent,
} from "@/types/music";
import { mergeAndSortTracks } from "@/lib/utils/search-helper";

type ProviderResolver = (source: MusicSource) => IMusicProvider;

export class AggregateProvider implements IMusicProvider {
  source = "aggregate" as const;
  constructor(
    private resolver: ProviderResolver,
    private getSources: () => MusicSource[]
  ) {}

  async search(
    query: string,
    page: number,
    count: number,
    signal?: AbortSignal,
    intent?: SearchIntent
  ): Promise<SearchPageResult<MusicTrack>> {
    const aggregatedSources = this.getSources();

    const results = await Promise.all(
      aggregatedSources.map((s) => {
        try {
          return this.resolver(s).search(query, page, count, signal, intent);
        } catch (e) {
          console.warn(`Search failed for ${s}`, e);
          return Promise.resolve({ items: [], hasMore: false });
        }
      })
    );

    if (signal?.aborted) return { items: [], hasMore: false };

    const merged = mergeAndSortTracks(
      results.flatMap((r) => r.items),
      query
    );

    return {
      items: merged,
      hasMore: results.every((r) => r.hasMore),
    };
  }

  async getUrl(_track: MusicTrack): Promise<string | null> {
    return null;
  }
  async getPic(_track: MusicTrack): Promise<string | null> {
    return null;
  }
  async getLyric(_track: MusicTrack): Promise<SongLyric | null> {
    return null;
  }
}
