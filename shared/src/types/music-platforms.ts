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
  copyright?: number | string;
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
// Bilibili
// ============================================================

export interface BilibiliSearchVideoRaw {
  type?: string;
  bvid?: string;
  title?: string;
  author?: string;
  uname?: string;
  mid?: number | string;
  pic?: string;
  season_id?: number;
}

export interface BilibiliSearchResponse {
  code?: number;
  message?: string;
  data?: {
    numResults?: number;
    result?: BilibiliSearchVideoRaw[];
  };
}

export interface BilibiliViewResponse {
  code?: number;
  message?: string;
  data?: {
    cid?: number;
    title?: string;
    pic?: string;
    pages?: Array<{
      cid?: number;
      page?: number;
      part?: string;
      duration?: number;
    }>;
    ugc_season?: {
      id?: number;
      title?: string;
      cover?: string;
    };
    owner?: {
      mid?: number;
      name?: string;
      face?: string;
    };
  };
}

export interface BilibiliPlayUrlResponse {
  code?: number;
  message?: string;
  data?: {
    dash?: {
      audio?: Array<BilibiliDashAudioEntry>;
    };
    durl?: Array<{
      url?: string;
      length?: number;
      size?: number;
    }>;
  };
}

export interface BilibiliDashAudioEntry {
  baseUrl?: string;
  base_url?: string;
  backupUrl?: string;
  backup_url?: string;
  url?: string;
  bandwidth?: number;
  mimeType?: string;
  codecs?: string;
}

export interface BilibiliDurlResponse {
  code?: number;
  message?: string;
  data?: {
    durl?: Array<{
      url?: string;
      length?: number;
      size?: number;
    }>;
  };
}

// ============================================================
// B站合集/系列 (Bilibili Series/Collection)
// ============================================================

export interface BilibiliSeriesMetaRaw {
  series_id?: number;
  name?: string;
  description?: string;
  creator?: {
    name?: string;
    mid?: number;
    face?: string;
  };
  total?: number;
  cover?: string;
}

export interface BilibiliSeriesResponse {
  code?: number;
  message?: string;
  data?: {
    meta?: BilibiliSeriesMetaRaw;
  };
}

export interface BilibiliSeriesArchiveRaw {
  bvid?: string;
  title?: string;
  cover?: string;
  duration?: number;
  owner?: {
    name?: string;
    mid?: number;
    face?: string;
  };
}

export interface BilibiliSeriesArchivesResponse {
  code?: number;
  message?: string;
  data?: {
    archives?: BilibiliSeriesArchiveRaw[];
    page?: {
      num?: number;
      size?: number;
      total?: number;
    };
  };
}

export interface BilibiliSeasonArchivesMetaRaw {
  category?: number;
  cover?: string;
  description?: string;
  mid?: number;
  name?: string;
  ptime?: number;
  season_id?: number;
  title?: string;
  total?: number;
}

export interface BilibiliSeasonArchiveRaw {
  aid: number;
  bvid: string;
  ctime: number;
  duration: number;
  pic: string;
  pubdate: number;
  stat: { view: number; vt: number; danmaku?: number };
  title: string;
}

export interface BilibiliSeasonsArchivesListResponse {
  code: number;
  message: string;
  data?: {
    aids: number[];
    archives: BilibiliSeasonArchiveRaw[];
    meta: BilibiliSeasonArchivesMetaRaw;
    page: {
      page_num: number;
      page_size: number;
      total: number;
    };
  };
}

// ============================================================
// B站音频歌单 (Bilibili Audio Playlists)
// ============================================================

export interface BilibiliAudioMenuHitItemRaw {
  menuId?: number;
  title?: string;
  cover?: string;
}

export interface BilibiliAudioMenuHitPageRaw {
  pageNo?: number;
  pageSize?: number;
  totalCount?: number;
}

export interface BilibiliAudioMenuHitResponseRaw {
  code?: number;
  data?: {
    data?: BilibiliAudioMenuHitItemRaw[];
    page?: BilibiliAudioMenuHitPageRaw;
  };
}

export interface BilibiliAudioMenuInfoRaw {
  menuId?: number;
  title?: string;
  cover?: string;
}

export interface BilibiliAudioMenuInfoResponseRaw {
  code?: number;
  data?: BilibiliAudioMenuInfoRaw;
}

export interface BilibiliAudioSongItemRaw {
  id?: number;
  title?: string;
  uname?: string;
  uid?: number;
  cover?: string;
}

export interface BilibiliAudioMenuSongsResponseRaw {
  code?: number;
  data?: {
    data?: BilibiliAudioSongItemRaw[];
  };
}

// ============================================================
// B站用户详情 (Bilibili User Card)
// ============================================================

export interface BilibiliUserCardResponse {
  code: number;
  message: string;
  data?: {
    mid: number;
    name: string;
    face: string;
  };
}

// ============================================================
// B站 OGV 番剧 (Bilibili PGC/Bangumi)
// ============================================================

export interface BilibiliOgvSeasonEpisode {
  aid: number;
  bvid: string;
  cid: number;
  title: string;
  long_title: string;
  cover: string;
  share_url: string;
}

// ============================================================
// 咪咕搜索 V3 (Migu Search V3)
// ============================================================

export interface MiguV3SearchSongRaw {
  copyrightId?: string;
  contentId?: string;
  songId?: string;
  songName?: string;
  singerList?: Array<{ id?: string; name?: string }>;
  albumId?: number | string;
  album?: string;
  img1?: string;
  img2?: string;
  img3?: string;
  ext?: {
    lrcUrl?: string;
    trcUrl?: string;
  };
  toneControl?: string;
  copyright?: number;
}

// ============================================================
// QQ 音乐
// ============================================================

export interface QqPlaylistResponse {
  code: number;
  subcode?: number;
  msg?: string;
  cdlist: QqCdItem[];
}

export interface QqCdItem {
  dissid: string;
  dissname: string;
  logo: string;
  songnum: number;
  songlist: QqSongRaw[];
}

export interface QqSongRaw {
  songid: string;
  songmid: string;
  songname: string;
  singer: QqSingerRaw[];
  albumname: string;
  albummid: string;
  interval: number;
  pay?: {
    payplay?: number;
    paydownload?: number;
    pay_play?: number;
    pay_down?: number;
  };
}

export interface QqSingerRaw {
  name: string;
}

export interface QqPlaylistDetail {
  name: string;
  coverUrl: string;
  trackCount: number;
  songs: QqSongRaw[];
}

export interface QqSearchSongRaw {
  id?: string;
  mid?: string;
  songid?: string;
  songmid?: string;
  title?: string;
  songname?: string;
  singer: QqSingerRaw[];
  album?: { id?: string; mid?: string; title?: string };
  albumid?: string;
  albummid?: string;
  albumname?: string;
  pay?: {
    payplay?: number;
    paydownload?: number;
    pay_play?: number;
    pay_down?: number;
  };
}

export interface QqSearchResponse {
  req_1: {
    code: number;
    data: {
      meta: { sum: number };
      body: { song: { list: QqSearchSongRaw[] } };
    };
  };
}

export interface QqVkeyResponse {
  req_1: {
    code: number;
    data: {
      sip: string[];
      midurlinfo: { purl: string; filename: string }[];
    };
  };
}
