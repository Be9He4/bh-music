const CACHE_NAME = 'audio-stream-cache';

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export interface CacheStats {
  entryCount: number;
  totalSize: number;
}

export async function getAudioCacheStats(): Promise<CacheStats> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    return { entryCount: requests.length, totalSize: 0 };
  } catch {
    return { entryCount: 0, totalSize: 0 };
  }
}

export async function getStorageUsage(): Promise<number> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const est = await navigator.storage.estimate();
      return est.usage ?? 0;
    }
  } catch { /* unavailable */ }
  return 0;
}

export async function clearAudioCache(): Promise<void> {
  await caches.delete(CACHE_NAME);
}
