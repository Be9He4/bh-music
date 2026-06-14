import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { MusicLayout } from "@/components/MusicLayout";
import { MusicNowPlayingBar } from "@/components/MusicNowPlayingBar";
import { MusicTabBar } from "@/components/MusicTabBar";
import { GlobalMusicPlayer } from "@/components/GlobalMusicPlayer";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import toast from "react-hot-toast";
import { toastUtils } from "@/lib/utils/toast";
import { useExitLayer } from "@/hooks/useExitLayer";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useCallback, useRef, lazy, Suspense } from "react";

const FullScreenPlayer = lazy(() =>
  import("@/components/FullScreenPlayer").then((m) => ({
    default: m.FullScreenPlayer,
  }))
);

const ROOT_TAB_PATHS = ["/", "/search", "/favorites", "/mine"] as const;

export function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isFullScreenPlayer, setIsFullScreenPlayer: setStoreFullScreen } =
    useMusicStore(
      useShallow((state) => ({
        isFullScreenPlayer: state.isFullScreenPlayer,
        setIsFullScreenPlayer: state.setIsFullScreenPlayer,
      }))
    );
  const { handleExit: handleExitLayer, push, pop } = useExitLayer();

  // Back Button Logic
  const locationRef = useRef(location);

  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  useEffect(() => {
    if (!isFullScreenPlayer) return;
    const id = push({
      close: () => setStoreFullScreen(false),
    });
    return () => {
      pop(id);
    };
  }, [isFullScreenPlayer, setStoreFullScreen, push, pop]);

  const isRootTabPath = useCallback((path: string) => {
    return ROOT_TAB_PATHS.includes(path as (typeof ROOT_TAB_PATHS)[number]);
  }, []);

  const handleBackAction = useCallback(async () => {
    if (handleExitLayer()) return;

    const path = locationRef.current.pathname;

    if (isRootTabPath(path)) {
      if (Capacitor.isNativePlatform()) {
        await CapacitorApp.minimizeApp();
      }
      return;
    }

    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate("/search", { replace: true });
  }, [handleExitLayer, isRootTabPath, navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = CapacitorApp.addListener("backButton", handleBackAction);

    return () => {
      listener.then((l) => l.remove());
    };
  }, [handleBackAction]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      const handled = handleExitLayer();
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleExitLayer]);

  const {
    queue,
    currentIndex,
    isPlaying,
    isLoading,
    isRepeat,
    isShuffle,
    togglePlay,
    setCurrentIndexAndPlay,
    toggleRepeat,
    toggleShuffle,
    isFavorite,
    addToFavorites,
    removeFromFavorites,
    coverUrl,
  } = useMusicStore(
    useShallow((state) => ({
      queue: state.queue,
      currentIndex: state.currentIndex,
      isPlaying: state.isPlaying,
      isLoading: state.isLoading,
      isRepeat: state.isRepeat,
      isShuffle: state.isShuffle,
      togglePlay: state.togglePlay,
      setCurrentIndexAndPlay: state.setCurrentIndexAndPlay,
      toggleRepeat: state.toggleRepeat,
      toggleShuffle: state.toggleShuffle,
      isFavorite: state.isFavorite,
      addToFavorites: state.addToFavorites,
      removeFromFavorites: state.removeFromFavorites,
      coverUrl: state.coverUrl,
    }))
  );

  const currentTrack = queue[currentIndex] || null;

  const isTab = isRootTabPath(location.pathname);

  // Handlers
  const handlePrev = () => {
    if (queue.length === 0) return;
    setCurrentIndexAndPlay((currentIndex - 1 + queue.length) % queue.length);
  };

  const handleNext = () => {
    if (queue.length === 0) return;
    setCurrentIndexAndPlay((currentIndex + 1) % queue.length);
  };

  const handleToggleLike = () => {
    if (!currentTrack) return;
    if (isFavorite(currentTrack.id)) {
      removeFromFavorites(currentTrack.id);
      toast.success("已取消喜欢");
    } else {
      const error = addToFavorites(currentTrack);
      if (error) {
        toastUtils.info(error);
      } else {
        toast.success("已喜欢");
      }
    }
  };

  return (
    <>
      <MusicLayout
        hidePlayer={isFullScreenPlayer || !currentTrack}
        isTab={isTab}
        player={
          <MusicNowPlayingBar
            onOpenFullScreen={() => setStoreFullScreen(true)}
            isTab={isTab}
          />
        }
        tabBar={<MusicTabBar />}
      >
        <Outlet />
      </MusicLayout>

      <GlobalMusicPlayer />

      <Suspense fallback={null}>
        <FullScreenPlayer
          isFullScreen={isFullScreenPlayer}
          onClose={() => setStoreFullScreen(false)}
          currentTrack={currentTrack}
          coverUrl={coverUrl}
          isFavorite={currentTrack ? isFavorite(currentTrack.id) : false}
          onToggleLike={handleToggleLike}
          isPlaying={isPlaying}
          isLoading={isLoading}
          isRepeat={isRepeat}
          isShuffle={isShuffle}
          onTogglePlay={togglePlay}
          onPrev={handlePrev}
          onNext={handleNext}
          onToggleRepeat={toggleRepeat}
          onToggleShuffle={toggleShuffle}
        />
      </Suspense>
    </>
  );
}
