import { useEffect } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { useMusicStore } from "@/store/music-store";
import { logger } from "@/lib/logger";
import { AudioRoute } from "@/plugins/audio-route";
import { IS_NATIVE } from "@/lib/api/config";

export function useAudioRouteSafety(
  audioRef: React.RefObject<HTMLAudioElement | null>
) {
  useEffect(() => {
    if (!IS_NATIVE) return;

    let listener: PluginListenerHandle | undefined;
    let disposed = false;

    const setupListener = async () => {
      try {
        listener = await AudioRoute.addListener("audioRouteLost", () => {
          const audio = audioRef.current;
          const state = useMusicStore.getState();
          if (audio?.paused !== false && !state.isPlaying) return;

          // 先同步 store 再暂停，避免被"外部抢占恢复"逻辑误判
          if (state.isPlaying) state.setIsPlaying(false);
          audio?.pause();
        });

        if (disposed) await listener.remove();
      } catch (error) {
        logger.warn(
          "useAudioRouteSafety",
          "Failed to listen for audio route loss",
          error
        );
      }
    };

    void setupListener();

    return () => {
      disposed = true;
      void listener?.remove();
    };
  }, [audioRef]);
}
