// Base entity with id/name shared across Netease API types
interface BaseEntity {
  id: number | string;
  name: string;
}

// Generic API response wrapper
export interface RawNeteaseResponse<T = unknown> {
  code: number;
  data?: T;
  result?: T;
  message?: string;
}

// Backend-compatible alias
export type NeteaseResponse<T = unknown> = RawNeteaseResponse<T>;

// QR login key response
export interface RawQrKeyData {
  code: number;
  unikey: string;
}
export type QrKeyResponse = RawQrKeyData;

// QR login status check response (union type for frontend, simplified for backend)
export type RawQrCheckResponse =
  | {
      code: number;
      message: string;
      cookie?: string;
    }
  | {
      message?: string;
      cookie?: string;
      data?: {
        code: number;
        message: string;
      };
    };
export type QrCheckResponse = RawQrCheckResponse;

// Song credits types
export interface NeteasePrivilege {
  id: number;
  fee: number;
  payed: number;
  st: number;
  pl: number;
  maxbr: number;
  plLevel: string;
  freeTrialPrivilege: {
    remainTime?: number;
  };
}

export interface SongArtist extends BaseEntity {
  tns?: string[];
  alias?: string[];
}

export interface SongAlbum extends BaseEntity {
  picUrl: string;
  tns?: string[];
  pic_str?: string;
  pic?: number;
}

// Song detail - merged from both frontend and backend
export interface SongDetail extends BaseEntity {
  ar: SongArtist[];
  al: SongAlbum;
  dt: number;
  fee: number;
  privilege?: NeteasePrivilege;
  publishTime?: number;
  st: number;
  // Backend-specific fields
  pst: number;
  t: number;
  pop: number;
  rt: string;
  v: number;
  cf?: string;
  cp?: number;
  mv?: number;
  // Search result aliases
  artists?: SongArtist[];
  album?: SongAlbum;
}

// Dynamic detail types
export interface AlbumDynamicDetail {
  onSale: boolean;
  commentCount: number;
  likedCount: number;
  shareCount: number;
  isSub: boolean;
  subTime: number;
  subCount: number;
}

export interface PlaylistDynamicDetail {
  bookedCount: number;
  subscribed: boolean;
  shareCount: number;
  commentCount: number;
  playCount: number;
}

// Player URL
export interface NeteasePlayerUrlItem {
  id: number;
  url: string | null;
  br: number;
  size: number;
  type: string;
  level: string;
  freeTrialInfo: unknown | null;
}

// Playlist track ID with additional metadata (from backend)
export interface PlaylistTrackId {
  id: number;
  v: number;
  t: number;
  at: number;
  uid: number;
  rcmdReason: string;
}

// Playlist detail - merged from both
export interface PlaylistDetail extends BaseEntity {
  coverImgUrl: string;
  description: string;
  trackCount: number;
  playCount: number;
  tracks: SongDetail[];
  trackIds: PlaylistTrackId[];
  creator?: UserProfile;
  subscribed?: boolean;
  // Backend-specific fields
  tags: string[];
  userId: number;
  createTime: number;
  updateTime: number;
  subscribedCount: number;
  shareCount: number;
  commentCount: number;
}

// User playlist (simplified)
export interface UserPlaylist extends BaseEntity {
  coverImgUrl: string;
  coverUrl?: string;
  picUrl?: string;
  trackCount: number;
  playCount: number;
  subscribed: boolean;
  creator: { nickname: string; userId: number };
}

// User profile - merged from both
export interface UserProfile {
  userId: number;
  nickname: string;
  avatarUrl: string;
  backgroundUrl?: string;
  signature?: string;
  vipType?: number;
  // Backend-specific fields
  userType?: number;
  follows?: number;
  followeds?: number;
  eventCount?: number;
  playlistCount?: number;
  playlistBeSubscribedCount?: number;
}

// Lyrics
export interface LyricDetail {
  lyric: string;
}

export interface NeteaseLyric {
  lrc: LyricDetail;
  tlyric?: LyricDetail;
  romalrc?: LyricDetail;
}

// Recommend playlist
export interface RecommendPlaylist extends BaseEntity {
  picUrl?: string;
  coverImgUrl?: string;
  coverUrl?: string;
  playCount: number;
  trackCount: number;
  copywriter?: string;
}

// Toplist
export interface Toplist extends BaseEntity {
  coverImgUrl: string;
  coverUrl?: string;
  picUrl?: string;
  updateFrequency: string;
  trackCount: number;
  playCount: number;
  ToplistType?: string;
}

// Album detail
export interface AlbumDetail {
  album: SongAlbum & {
    description: string;
    artist: SongArtist;
    size: number;
    publishTime: number;
    company?: string;
    subType?: string;
  };
  songs: SongDetail[];
}

// Artist detail
export interface ArtistDetail {
  artist: SongArtist & {
    picUrl: string;
    briefDesc: string;
    musicSize: number;
    albumSize: number;
    mvSize: number;
    followed: boolean;
  };
  hotSongs: SongDetail[];
}

// Artist list item
export interface ArtistItem extends BaseEntity {
  picUrl: string;
  albumSize: number;
}

// Artist album
export interface ArtistAlbum extends BaseEntity {
  picUrl: string;
  publishTime: number;
  size: number;
  type?: string;
  artist?: ArtistItem;
}

// Search result
export type NeteaseSearchResult = {
  songs?: SongDetail[];
  playlists?: UserPlaylist[];
  songCount?: number;
  hasMore?: boolean;
};

// URL resolver
export interface ResolveUrlResult {
  type: "playlist" | "artist" | "album" | "song";
  id: string;
}

// Cookie (used in frontend)
export interface CookieItem {
  url: string;
  name: string;
  value: string;
  expirationDate?: number;
}

// Search suggest
export interface SearchSuggestResult {
  songs?: Array<{
    id: number;
    name: string;
    artists: Array<{ id: number; name: string; picUrl?: string }>;
    album: { id: number; name: string; status: number; copyrightId: number };
  }>;
  artists?: Array<{
    id: number;
    name: string;
    picUrl: string;
    alias: string[];
  }>;
  albums?: Array<{
    id: number;
    name: string;
    artist: { name: string; picUrl: string };
    status: number;
    copyrightId: number;
  }>;
  playlists?: Array<{
    id: number;
    name: string;
    coverImgUrl: string;
    creator: { nickname: string };
    trackCount: number;
    playCount: number;
    bookCount: number;
  }>;
  order?: string[];
}

// Comments
export interface NeteaseCommentUser {
  userId: number;
  nickname: string;
  avatarUrl: string;
}

export interface NeteaseComment {
  user: NeteaseCommentUser;
  commentId: number;
  content: string;
  time: number;
  likedCount: number;
}

export interface NeteaseCommentResult {
  isMusician: boolean;
  cnum: number;
  userId: number;
  topComments: NeteaseComment[];
  moreHot: boolean;
  hotComments: NeteaseComment[];
  commentBanner?: unknown;
  code: number;
  comments: NeteaseComment[];
  total: number;
  more: boolean;
}

export interface NeteaseNewCommentResult {
  code: number;
  data: {
    comments: NeteaseComment[];
    currentComment: unknown;
    totalCount: number;
    hasMore: boolean;
    cursor: string;
    sortType: number;
    sortTypeList: Array<{
      sortType: number;
      sortTypeName: string;
      isDefault: boolean;
    }>;
  };
}
