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
