const upNameCache = new Map<number, string>();

export function setUpNameCache(mid: number, name: string): void {
  if (mid && name) {
    upNameCache.set(mid, name);
  }
}

export function getUpNameCache(mid: number): string | undefined {
  return upNameCache.get(mid);
}
