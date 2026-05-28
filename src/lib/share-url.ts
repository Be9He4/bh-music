import { MusicTrack } from "@/types/music";

/**
 * 获取音乐曲目的规范分享链接
 * @param track - 音乐曲目对象
 * @returns 分享链接字符串，若不支持则返回 null
 */
export function getCanonicalShareUrl(track: MusicTrack): string | null {
  const { id, source } = track;

  // B站视频：提取 BV 号并生成官方链接
  if (source === "bilibili") {
    const bvid = id.startsWith("bilibili_") ? id.slice(9) : id;
    return `https://www.bilibili.com/video/${bvid}`;
  }

  return null;
}
