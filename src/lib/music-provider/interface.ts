import {
  MusicTrack,
  SearchPageResult,
  SongLyric,
  SearchIntent,
} from "@/types/music";

export interface IMusicProvider {
  // 音源
  source: string;
  // 核心能力
  search(
    query: string,
    page: number,
    count: number,
    signal?: AbortSignal,
    intent?: SearchIntent | null
  ): Promise<SearchPageResult<MusicTrack>>;
  getUrl(track: MusicTrack, br?: number): Promise<string | null>;
  getPic(track: MusicTrack, size?: number): Promise<string | null>;
  getLyric(track: MusicTrack): Promise<SongLyric | null>;

  // 属性标志 (可选)
  canUnlock?: boolean; // 是否支持解锁逻辑（如网易云变灰歌曲）

  // 扩展能力 (Feature Detection)

  /** 获取歌曲详情 (替代 API 直接调用) */
  getSongDetail?(id: string): Promise<any>;

  /** 获取歌手详情 */
  getArtistDetail?(id: string): Promise<any>;

  /** 获取专辑详情 */
  getAlbumDetail?(id: string): Promise<any>;

  /** 获取评论 */
  getComments?(songId: string): Promise<any>;

  /**
   * 搜索歌手 (用于 UI 判断是否显示入口)
   * 通常内部调用 search(..., { type: 'artist' })
   */
  searchArtist?(
    query: string,
    page: number,
    count: number
  ): Promise<SearchPageResult<MusicTrack>>;

  /**
   * 搜索专辑 (用于 UI 判断是否显示入口)
   * 通常内部调用 search(..., { type: 'album' })
   */
  searchAlbum?(
    query: string,
    page: number,
    count: number
  ): Promise<SearchPageResult<MusicTrack>>;

  /** 自定义自动换源匹配谓词（可选） */
  getAutoMatchPredicate?(
    target: MusicTrack
  ): (candidate: MusicTrack) => boolean;

  /** 自定义自动换源搜索词（可选），用于优化特定音源的搜索结果 */
  getAutoMatchQuery?(target: MusicTrack, baseQuery: string): string;

  /** 自定义自动换源搜索数量（可选），用于需要更大搜索范围以提升命中率的音源 */
  getAutoMatchCount?(target: MusicTrack): number;
}
