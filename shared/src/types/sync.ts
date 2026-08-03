export const SYNC_KEY_PREFIX = "bh-music:user:";

export interface SyncKeyMetadata {
  lastSyncTime: number;
  sizeBytes?: number;
  version: number;
}

export interface SyncKeyItem {
  key: string;
  lastSyncTime: number;
}
