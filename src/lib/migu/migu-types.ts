export interface MiguPlaylistInfoResponse {
  code?: string;
  info?: string;
  resource?: MiguPlaylistInfoRaw[];
}

export interface MiguPlaylistInfoRaw {
  title?: string;
  musicListId?: string;
  musicNum?: number;
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

export interface MiguPlaylistDetail {
  name: string;
  coverUrl: string;
  trackCount: number;
  songs: MiguSongRaw[];
}

export interface MiguSongUrlResponse {
  code?: string;
  info?: string;
  data?: {
    url?: string;
    playUrl?: string;
    lrcUrl?: string;
  };
}
