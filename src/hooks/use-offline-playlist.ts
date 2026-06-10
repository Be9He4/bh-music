import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { MusicTrack } from "@/types/music";
import { useOfflineStore } from "@/store/offline-store";
import { useLocalMusicStore } from "@/store/local-music-store";
import { useDownloadStore } from "@/store/download-store";
import { convertToMusicTrack } from "@/lib/utils/download";
import { Capacitor } from "@capacitor/core";

/**
 * 聚合离线可播放曲目：下载 > 流媒体缓存 > 本地文件
 * 去重逻辑：同一 trackId 只保留最高优先级来源
 */
export function useOfflinePlaylist(): MusicTrack[] {
  const offlineRecords = useOfflineStore((s) => s.records);
  const localFiles = useLocalMusicStore((s) => s.files);
  const downloadStore = useDownloadStore(
    useShallow((s) => ({
      records: s.records,
      getRecord: s.getRecord,
    }))
  );

  return useMemo(() => {
    const seen = new Set<string>();
    const tracks: MusicTrack[] = [];

    // 1. 下载曲目（最高优先级）
    for (const key of Object.keys(downloadStore.records)) {
      const sepIdx = key.indexOf(":");
      if (sepIdx === -1) continue;
      const source = key.slice(0, sepIdx);
      const id = key.slice(sepIdx + 1);
      const trackId = id;

      if (seen.has(trackId)) continue;
      seen.add(trackId);

      const rec = downloadStore.getRecord(key);
      if (rec) {
        tracks.push({
          id: trackId,
          name: rec.name || `${source}:${id}`,
          artist: rec.artist.length > 0 ? rec.artist : ["未知艺术家"],
          album: rec.album,
          source: rec.trackSource,
          url_id: rec.url_id,
          pic_id: rec.pic_id,
          lyric_id: rec.lyric_id,
        });
      } else {
        // 旧格式或元数据缺失时用 key 构造最小 track
        tracks.push({
          id: trackId,
          name: `${source}:${id}`,
          artist: ["未知艺术家"],
          album: "",
          source: source as MusicTrack["source"],
          url_id: id,
          pic_id: "",
          lyric_id: "",
        });
      }
    }

    // 2. 流媒体缓存曲目
    for (const record of Object.values(offlineRecords)) {
      if (record.source !== "stream-cache") continue;
      if (seen.has(record.trackId)) continue;
      seen.add(record.trackId);

      tracks.push({
        id: record.trackId,
        name: record.name,
        artist: record.artist,
        album: record.album,
        source: record.trackSource,
        url_id: record.url_id,
        pic_id: record.pic_id,
        lyric_id: record.lyric_id,
      });
    }

    // 3. 本地音乐文件（最低优先级）
    if (Capacitor.isNativePlatform()) {
      for (const file of localFiles) {
        const track = convertToMusicTrack(file);
        if (seen.has(track.id)) continue;
        seen.add(track.id);
        tracks.push(track);
      }
    }

    return tracks;
  }, [offlineRecords, localFiles, downloadStore]);
}
