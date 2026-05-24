export const forceHttps = (url: string | undefined | null): string => {
  if (!url) return '';
  return url.replace(/^http:\/\//i, 'https://');
};

export function normalizeResourceUrl(url: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  return forceHttps(url);
}
