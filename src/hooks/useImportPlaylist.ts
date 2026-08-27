import { useCallback } from "react";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import type { MusicTrack } from "@/types/music";
import toast from "react-hot-toast";

/**
 * 将歌曲列表整体导入为一个新歌单。
 * 供各 Detail 页面右上角「导入歌单」入口复用。
 */
export function useImportPlaylist() {
  const { createPlaylist, setPlaylistTracks } = useMusicStore(
    useShallow((state) => ({
      createPlaylist: state.createPlaylist,
      setPlaylistTracks: state.setPlaylistTracks,
    }))
  );

  return useCallback(
    (name: string, coverUrl: string | undefined, tracks: MusicTrack[]) => {
      if (!tracks.length) return;
      const toastId = toast.loading(`正在导入 ${tracks.length} 首歌曲...`);
      try {
        const newPlaylistId = createPlaylist(name, coverUrl);
        setPlaylistTracks(newPlaylistId, tracks);
        toast.success(`成功导入 ${tracks.length} 首歌曲`, { id: toastId });
      } catch {
        toast.error("导入失败", { id: toastId });
      }
    },
    [createPlaylist, setPlaylistTracks]
  );
}
