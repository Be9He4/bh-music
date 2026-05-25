import { registerPlugin } from "@capacitor/core";

export interface LocalMusicFile {
  id: string;
  name: string | null;
  artist: string | null;
  album: string | null;
  duration: number;
  localPath: string;
  fileSize: number;
  modifiedTime?: number;
}

export interface ScanResult {
  success: boolean;
  files: LocalMusicFile[];
  error?: string;
  needManageStorage?: boolean;
}

export interface LocalFileUrlResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface EmbeddedCoverResult {
  success: boolean;
  dataUrl?: string;
  error?: string;
}

export interface EmbeddedLyricsResult {
  success: boolean;
  lyric?: string;
  error?: string;
}

export interface HasPermissionResult {
  hasPermission: boolean;
}

export interface DeleteResult {
  success: boolean;
  error?: string;
}

export interface PickDirectoryResult {
  success: boolean;
  path?: string;
  uri?: string;
  error?: string;
}

export interface LocalMusicPlugin {
  scanLocalMusic(): Promise<ScanResult>;
  scanAllStorage(): Promise<ScanResult>;
  getLocalFileUrl(options: { localPath: string }): Promise<LocalFileUrlResult>;
  getEmbeddedCover(options: {
    localPath: string;
  }): Promise<EmbeddedCoverResult>;
  getEmbeddedLyrics(options: {
    localPath: string;
  }): Promise<EmbeddedLyricsResult>;
  openManageStorageSettings(): Promise<void>;
  hasAllStoragePermission(): Promise<HasPermissionResult>;
  deleteLocalMusic(options: { localPath: string }): Promise<DeleteResult>;
  pickDownloadDirectory(): Promise<PickDirectoryResult>;
}

const LocalMusicPlugin = registerPlugin<LocalMusicPlugin>("LocalMusicPlugin");

export { LocalMusicPlugin };
