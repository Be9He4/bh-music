/** Blob URL 追踪注册表，用于统一释放 */
const blobRegistry = new Set<string>();

export function registerBlobUrl(url: string): void {
  blobRegistry.add(url);
}

export function revokeBlobUrl(url: string): void {
  if (blobRegistry.delete(url)) {
    URL.revokeObjectURL(url);
  }
}

export function revokeAll(): void {
  blobRegistry.forEach((url) => URL.revokeObjectURL(url));
  blobRegistry.clear();
}
