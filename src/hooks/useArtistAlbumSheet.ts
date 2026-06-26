import { useEffect, useState } from "react";
import { NavigateFunction } from "react-router-dom";
import {
  ArtistAlbumSheetNavigationState,
  shouldRestoreArtistAlbumSheet,
  consumeAlbumSheetRestoreSession,
  getArtistAlbumSheetBackTarget,
  setAlbumSheetRestoreSession,
} from "@/lib/navigation/netease-detail-navigation";

interface UseArtistAlbumSheetProps {
  id: string | null;
  type: "playlist" | "artist" | "album";
  navigationState: ArtistAlbumSheetNavigationState | null;
  pathname: string;
  navigate: NavigateFunction;
  pushExitLayer: (options: { close: () => void }) => string;
  popExitLayer: (id: string) => void;
}

/**
 * 封装 ArtistAlbumSheet 的状态恢复、硬件返回键拦截、返回处理逻辑。
 * 从 NeteaseDetail 中抽离，避免页面组件承担跨页面交互职责。
 */
export function useArtistAlbumSheet({
  id,
  type,
  navigationState,
  pathname,
  navigate,
  pushExitLayer,
  popExitLayer,
}: UseArtistAlbumSheetProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (type !== "artist" || !id) return false;

    // 优先从 location.state 恢复（首次进入）
    if (shouldRestoreArtistAlbumSheet(type, id, navigationState)) {
      return true;
    }

    // 从 sessionStorage 恢复（navigate(-1) 回退时）
    const sessionRestore = consumeAlbumSheetRestoreSession();
    return sessionRestore?.artistId === id;
  });

  // 清理 location.state，避免刷新后再次触发恢复
  useEffect(() => {
    if (type !== "artist" || !id) return;

    if (shouldRestoreArtistAlbumSheet(type, id, navigationState)) {
      navigate(pathname, { replace: true, state: null });
    }
  }, [type, id, navigationState, navigate, pathname]);

  // 拦截硬件返回键：从专辑页返回歌手页时使用 navigate(-1) + sessionStorage
  useEffect(() => {
    const backTarget = getArtistAlbumSheetBackTarget(type, navigationState);
    if (!backTarget) return;

    const layerId = pushExitLayer({
      close: () => {
        setAlbumSheetRestoreSession(backTarget.artistId, backTarget.artistName);
        navigate(-1);
      },
    });
    return () => popExitLayer(layerId);
  }, [type, navigationState, pushExitLayer, popExitLayer, navigate]);

  /** 统一返回处理：若存在 backTarget 则写 sessionStorage 并 navigate(-1)，否则执行 fallback */
  const handleBack = (fallbackOnBack: () => void) => {
    const backTarget = getArtistAlbumSheetBackTarget(type, navigationState);
    if (backTarget) {
      setAlbumSheetRestoreSession(backTarget.artistId, backTarget.artistName);
      navigate(-1);
      return;
    }
    fallbackOnBack();
  };

  return { isOpen, setIsOpen, handleBack };
}
