// ============================================================
// 酷狗 (Kugou)
// ============================================================

export interface KugouPlaylistResponse {
  status: number;
  errcode: number;
  error?: string;
  data?: {
    total?: number;
    info?: KugouSongRaw[];
  };
}

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

export interface KugouPlaylistDetail {
  name: string;
  coverUrl: string;
  trackCount: number;
  songs: KugouSongRaw[];
}

// ============================================================
// 酷我 (Kuwo)
// ============================================================

export interface KuwoPlaylistResponse {
  result?: string;
  msg?: string;
  title?: string;
  pic?: string;
  total?: number;
  musiclist?: KuwoSongRaw[];
}

export interface KuwoSongRaw {
  id?: string | number;
  rid?: string | number;
  musicrid?: string;
  name?: string;
  songname?: string;
  artist?: string;
  album?: string;
  albumid?: string | number;
  albumpic?: string;
  pic?: string;
}

export interface KuwoPlaylistDetail {
  name: string;
  coverUrl: string;
  trackCount: number;
  songs: KuwoSongRaw[];
}

// ============================================================
// 咪咕 (Migu)
// ============================================================

export interface MiguPlaylistInfoResponse {
  code?: string;
  info?: string;
  resource?: MiguPlaylistInfoRaw[];
}

export interface MiguPlaylistInfoRaw {
  title?: string;
  musicNum?: number;
  musicListId?: string;
  imgItem?: {
    img?: string;
  };
}

export interface MiguPlaylistSongsResponse {
  code?: string;
  info?: string;
  totalCount?: number;
  list?: MiguSongRaw[];
}

export interface MiguSongRaw {
  copyrightId?: string;
  contentId?: string;
  songId?: string;
  songName?: string;
  singer?: string;
  album?: string;
  albumId?: string;
  albumImgs?: Array<{ img?: string; imgSizeType?: string }>;
  artists?: Array<{ id?: string; name?: string }>;
  lrcUrl?: string;
}

export interface MiguSongUrlResponse {
  code?: string;
  info?: string;
  data?: {
    url?: string;
    playUrl?: string;
  };
}

export interface MiguPlaylistDetail {
  name: string;
  coverUrl: string;
  trackCount: number;
  songs: MiguSongRaw[];
}

// ============================================================
// 咪咕搜索 (Migu Search)
// ============================================================

export interface MiguSearchResponse {
  code?: string;
  songResultData?: {
    totalCount?: string;
    result?: MiguSearchSongRaw[];
  };
}

export interface MiguSearchSongRaw {
  copyrightId?: string;
  contentId?: string;
  name?: string;
  singers?: Array<{ id?: string; name?: string }>;
  albums?: Array<{ id?: string; name?: string }>;
  lyricUrl?: string;
  imgItems?: Array<{ imgSizeType?: string; img?: string }>;
}
