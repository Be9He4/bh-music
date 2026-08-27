import { useEffect } from "react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { useMusicStore } from "@/store/music-store";
import { logger } from "@/lib/logger";
import { AudioRoute } from "@/plugins/audio-route";

export function useAudioRouteSafety(
  audioRef: React.RefObject<HTMLAudioElement | null>
) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener: PluginListenerHandle | undefined;
    let disposed = false;

    const setupListener = async () => {
      try {
        listener = await AudioRoute.addListener("audioRouteLost", () => {
          const audio = audioRef.current;
          const state = useMusicStore.getState();
          if (audio?.paused !== false && !state.isPlaying) return;

          audio?.pause();
          if (state.isPlaying) state.setIsPlaying(false);
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
