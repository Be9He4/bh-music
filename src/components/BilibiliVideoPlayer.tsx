import { createPortal } from "react-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { MusicTrack } from "@/types/music";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils/time";
import { useExitLayerStore } from "@/hooks/useExitLayer";
import { getRawAudioCurrentTime } from "@/hooks/useAudioEventHandlers";
import { MusicProviderFactory } from "@/lib/music-provider";
import { useMusicStore } from "@/store/music-store";
import { useMounted } from "@/hooks/use-mounted";
import { logger } from "@/lib/logger";
import { X, Play, Pause, Maximize } from "lucide-react";

interface BilibiliVideoPlayerProps {
  track: MusicTrack;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BilibiliVideoPlayer({
  track,
  open,
  onOpenChange,
}: BilibiliVideoPlayerProps) {
  const mounted = useMounted();
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLInputElement>(null);
  const exitLayerIdRef = useRef<string | null>(null);
  const initDoneRef = useRef(false);
  const push = useExitLayerStore((s) => s.push);
  const pop = useExitLayerStore((s) => s.pop);

  // Audio playback state
  const currentAudioTime = useMusicStore((s) => s.currentAudioTime);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const queue = useMusicStore((s) => s.queue);
  const currentIndex = useMusicStore((s) => s.currentIndex);
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const seek = useMusicStore((s) => s.seek);
  const playTrackAsNext = useMusicStore((s) => s.playTrackAsNext);
  const playbackSpeed = useMusicStore((s) => s.playbackSpeed);

  const currentTrack = queue[currentIndex] || null;

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [seekTime, setSeekTime] = useState(0);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Exit layer
  useEffect(() => {
    if (!open) return;
    initDoneRef.current = false;
    const id = push({ close: handleClose });
    exitLayerIdRef.current = id;
    return () => {
      if (exitLayerIdRef.current) {
        pop(exitLayerIdRef.current);
        exitLayerIdRef.current = null;
      }
    };
  }, [open, push, pop, handleClose]);

  // Fetch video URL
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    const fetchVideo = async () => {
      setLoading(true);
      setError(false);
      setVideoUrl(null);

      const provider = MusicProviderFactory.getProvider(track.source);
      if (!provider.getVideoUrl) {
        if (!cancelled) setError(true);
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const url = await provider.getVideoUrl(track);
        if (cancelled) return;
        if (!url) {
          setError(true);
        } else {
          setVideoUrl(url);
        }
      } catch (e) {
        if (!cancelled) {
          logger.error("[BilibiliVideoPlayer] Failed to get video URL:", e);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchVideo();

    return () => {
      cancelled = true;
    };
  }, [open, track]);

  // On video URL ready, sync with audio state
  useEffect(() => {
    if (!open || !videoUrl || initDoneRef.current) return;

    const video = videoRef.current;
    if (!video) return;

    const isCurrentTrack = track.id === currentTrack?.id;

    if (isCurrentTrack) {
      video.currentTime = currentAudioTime;
      if (isPlaying) {
        video.play().catch(() => {});
      }
    } else {
      playTrackAsNext(track);
    }

    initDoneRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, videoUrl]);

  // Sync audio playback speed to video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !open) return;
    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [isPlaying, open]);

  // Sync audio currentTime to video
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || seeking) return;
      if (video.seeking || video.readyState < 3) return;

      const diff = Math.abs(video.currentTime - getRawAudioCurrentTime());
      if (diff > 0.5) {
        video.currentTime = getRawAudioCurrentTime();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [open, seeking]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || seeking) return;
    setVideoCurrentTime(Math.floor(video.currentTime));
  }, [seeking]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setVideoDuration(Math.floor(video.duration));
  }, []);

  const handleProgressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = Number(e.target.value);
      setSeekTime(time);
      setVideoCurrentTime(time);
    },
    []
  );

  const handleProgressCommit = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = seekTime;
    seek(seekTime);
    setSeeking(false);
  }, [seekTime, seek]);

  const handleProgressStart = useCallback(() => {
    setSeeking(true);
  }, []);

  // Sync video playback rate to store
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen().catch(() => {});
    }
  }, []);

  const handleVideoClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest(".video-controls")) return;
      togglePlay();
    },
    [togglePlay]
  );

  // Override native video control actions during fullscreen
  const handleVideoPause = useCallback(() => {
    const video = videoRef.current;
    if (!video || !open) return;
    if (useMusicStore.getState().isPlaying) {
      video.play().catch(() => {});
    }
  }, [open]);

  const handleVideoPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !open) return;
    if (!useMusicStore.getState().isPlaying) {
      video.pause();
    }
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black flex flex-col touch-none select-none">
      {/* Top bar */}
      <div className="flex items-center h-12 px-3 shrink-0 bg-black/60">
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-white hover:bg-white/10"
          onClick={handleClose}
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="ml-2 text-white text-sm font-medium truncate flex-1 text-center pr-10">
          {track.name}
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        {loading ? (
          <div className="text-white/60 text-sm">加载中...</div>
        ) : error || !videoUrl ? (
          <div className="text-white/60 text-sm">视频加载失败</div>
        ) : (
          <video
            ref={videoRef}
            src={videoUrl}
            className="max-w-full max-h-full object-contain"
            playsInline
            muted
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={handleVideoPlay}
            onPause={handleVideoPause}
            onError={() => setError(true)}
            onClick={handleVideoClick}
          />
        )}
      </div>

      {/* Controls */}
      <div className="video-controls shrink-0 bg-black/60 px-3 pb-3 pt-1">
        {/* Progress bar */}
        <input
          ref={progressRef}
          type="range"
          min={0}
          max={videoDuration || 0}
          value={seeking ? seekTime : videoCurrentTime}
          onChange={handleProgressChange}
          onMouseDown={handleProgressStart}
          onTouchStart={handleProgressStart}
          onMouseUp={handleProgressCommit}
          onTouchEnd={handleProgressCommit}
          className={cn(
            "w-full h-1 appearance-none bg-white/20 rounded-full outline-none cursor-pointer mb-2",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
          )}
        />

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/10"
              onClick={togglePlay}
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5" />
              )}
            </Button>
            <span className="text-white text-xs tabular-nums min-w-[90px]">
              {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-white hover:bg-white/10"
              onClick={toggleFullscreen}
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
