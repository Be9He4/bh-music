/** 酷狗歌单接口原始响应。 */
export interface KugouPlaylistResponse {
  status: number;
  errcode: number;
  error?: string;
  data?: {
    total?: number;
    info?: KugouSongRaw[];
  };
}

/** 酷狗新版 global_collection_id 歌曲接口响应。 */
export interface KugouGlobalPlaylistSongsResponse {
  status: number;
  error_code?: number;
  error?: string;
  data?: {
    total?: number;
    info?: KugouSongRaw[];
    list?: KugouSongRaw[];
  };
}

/** 酷狗新版 global_collection_id 歌单详情接口响应。 */
export interface KugouGlobalPlaylistInfoResponse {
  status: number;
  error_code?: number;
  error?: string;
  data?: Array<{
    global_collection_id?: string;
    name?: string;
    specialname?: string;
    title?: string;
    img?: string;
    pic?: string;
    cover?: string;
    cover_url?: string;
    song_count?: number;
    count?: number;
  }>;
}

/** 酷狗歌单页面内嵌歌曲对象。 */
export interface KugouSongRaw {
  hash?: string;
  HASH?: string;
  audio_id?: number | string;
  album_audio_id?: number | string;
  songname?: string;
  audio_name?: string;
  filename?: string;
  singername?: string;
  author_name?: string;
  authors?: Array<{ author_name?: string }>;
  album_name?: string;
  albumname?: string;
  trans_param?: {
    union_cover?: string;
  };
}

/** 清理后的酷狗歌单详情。 */
export interface KugouPlaylistDetail {
  name: string;
  coverUrl: string;
  trackCount: number;
  songs: KugouSongRaw[];
}
