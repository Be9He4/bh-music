/**
 * 根据 URL hostname 识别音乐平台。
 * 返回平台标识符或 null (不支持的链接)。
 */
export type Platform = 'netease' | 'qq' | 'kugou' | 'kuwo' | 'migu';

export function detectPlatform(urlStr: string): Platform | null {
  try {
    const url = new URL(
      urlStr.startsWith('http') ? urlStr : `https://${urlStr}`
    );

    if (url.hostname === 'music.163.com' || url.hostname === 'y.music.163.com') {
      return 'netease';
    }
    if (url.hostname === 'y.qq.com' || url.hostname.endsWith('.y.qq.com')) {
      return 'qq';
    }
    if (url.hostname === 'kugou.com' || url.hostname.endsWith('.kugou.com')) {
      return 'kugou';
    }
    if (url.hostname === 'kuwo.cn' || url.hostname.endsWith('.kuwo.cn')) {
      return 'kuwo';
    }
    if (url.hostname === 'migu.cn' || url.hostname.endsWith('.migu.cn')) {
      return 'migu';
    }
    return null;
  } catch {
    return null;
  }
}
