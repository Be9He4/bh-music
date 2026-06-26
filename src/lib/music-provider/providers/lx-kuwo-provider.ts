import { KuwoProvider } from "./kuwo-provider";
import {
  MusicTrack,
  SearchPageResult,
  SongLyric,
  SearchIntent,
  type MusicSource,
} from "@otter-music/shared";
import { getLxUrl } from "@/lib/utils/lx-api";
import { normalizeTrack, requestMusicApiJSON } from "../utils";
import { retry } from "@/lib/utils";
import { RawApiTrack } from "../types";

/** 洛雪版酷我音源：搜索/图片/歌词复用 GD Studio API（source=kuwo），URL 走 LX API */
export class LxKuwoProvider extends KuwoProvider {
  source: MusicSource = "lx_kuwo";

  private static readonly API_SOURCE: MusicSource = "kuwo";

  async search(
    query: string,
    page: number,
    count: number,
    signal?: AbortSignal,
    _intent?: SearchIntent | null
  ): Promise<SearchPageResult<MusicTrack>> {
    const json = await retry(
      () =>
        requestMusicApiJSON<RawApiTrack[]>(
          { types: "search", name: query, count, pages: page },
          LxKuwoProvider.API_SOURCE,
          signal
        ),
      2,
      800
    );
    const items = json.map((t) => normalizeTrack(t, this.source));
    return { items, hasMore: items.length === count };
  }

  async getUrl(track: MusicTrack, br?: number): Promise<string | null> {
    return getLxUrl("lx_kuwo", track.url_id, br);
  }

  async getPic(track: MusicTrack, size: number = 800): Promise<string | null> {
    const json = await requestMusicApiJSON<{ url?: string }>(
      { types: "pic", id: track.pic_id, size },
      LxKuwoProvider.API_SOURCE
    );
    return json.url || null;
  }

  async getLyric(track: MusicTrack): Promise<SongLyric | null> {
    const json = await requestMusicApiJSON<{ lyric?: string; tlyric?: string }>(
      { types: "lyric", id: track.lyric_id },
      LxKuwoProvider.API_SOURCE
    );
    return { lyric: json.lyric ?? "", tlyric: json.tlyric ?? "" };
  }
}
