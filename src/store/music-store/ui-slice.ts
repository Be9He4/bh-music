import type { StateCreator } from "zustand";
import type { MusicState } from "./types";
import {
  DEFAULT_SOURCE_CONFIGS,
  type MusicSource,
  type SourceConfig,
} from "@/types/music";

export type FullScreenBackgroundMode = "theme" | "cover" | "texture";
export type LyricAlign = "center" | "left" | "right";

export interface AutoMatchContext {
  index: number;
  tried: Set<MusicSource>;
}

export interface UiSlice {
  quality: string;
  searchSource: MusicSource;
  sourceConfigs: SourceConfig[];
  lastPlaylistCategory: string;
  lastMineTab: "recommend" | "created" | "subscribed" | "albums";
  lastFeaturedTab: string;
  lastBillboardGroup: "songs" | "albums" | "artists";
  enableAutoMatch: boolean;
  autoMatchFavorites: boolean;
  autoMatchPlaylists: boolean;
  autoMatchContext: AutoMatchContext | null;
  enableProxyFallback: boolean;
  bilibiliKeepOriginalMeta: boolean;
  bilibiliAutoMatchSuffix: string;
  fullScreenBackgroundMode: FullScreenBackgroundMode;
  showSourceBadge: boolean;
  lyricAlign: LyricAlign;
  lyricFontSize: number;
  lyricOffset: number;
  playbackSpeed: number;
  isFullScreenPlayer: boolean;
  setQuality: (quality: string) => void;
  setSearchSource: (source: MusicSource) => void;
  setSourceConfigs: (configs: SourceConfig[]) => void;
  setLastPlaylistCategory: (category: string) => void;
  setLastMineTab: (
    tab: "recommend" | "created" | "subscribed" | "albums"
  ) => void;
  setLastFeaturedTab: (tab: string) => void;
  setLastBillboardGroup: (group: "songs" | "albums" | "artists") => void;
  setEnableAutoMatch: (enable: boolean) => void;
  setAutoMatchFavorites: (enable: boolean) => void;
  setAutoMatchPlaylists: (enable: boolean) => void;
  setAutoMatchContext: (ctx: AutoMatchContext | null) => void;
  setEnableProxyFallback: (enable: boolean) => void;
  setBilibiliKeepOriginalMeta: (enable: boolean) => void;
  setBilibiliAutoMatchSuffix: (suffix: string) => void;
  setFullScreenBackgroundMode: (mode: FullScreenBackgroundMode) => void;
  setShowSourceBadge: (show: boolean) => void;
  setLyricAlign: (align: LyricAlign) => void;
  setLyricFontSize: (size: number) => void;
  setLyricOffset: (offset: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  setIsFullScreenPlayer: (isFullScreen: boolean) => void;
}

export const createUiSlice: StateCreator<MusicState, [], [], UiSlice> = (
  set
) => ({
  quality: "192",
  searchSource: "all",
  sourceConfigs: DEFAULT_SOURCE_CONFIGS,
  lastPlaylistCategory: "全部",
  lastMineTab: "recommend",
  lastFeaturedTab: "",
  lastBillboardGroup: "songs",
  enableAutoMatch: true,
  autoMatchFavorites: false,
  autoMatchPlaylists: true,
  autoMatchContext: null,
  enableProxyFallback: true,
  bilibiliKeepOriginalMeta: false,
  bilibiliAutoMatchSuffix: "高音质 原曲",
  fullScreenBackgroundMode: "theme",
  showSourceBadge: true,
  lyricAlign: "center",
  lyricFontSize: 18,
  lyricOffset: -0.5,
  playbackSpeed: 1.0,
  isFullScreenPlayer: false,
  setQuality: (quality) => set({ quality }),
  setSearchSource: (searchSource) => set({ searchSource }),
  setSourceConfigs: (sourceConfigs) => set({ sourceConfigs }),
  setLastPlaylistCategory: (lastPlaylistCategory) =>
    set({ lastPlaylistCategory }),
  setLastMineTab: (lastMineTab) => set({ lastMineTab }),
  setLastFeaturedTab: (lastFeaturedTab) => set({ lastFeaturedTab }),
  setLastBillboardGroup: (lastBillboardGroup) => set({ lastBillboardGroup }),
  setEnableAutoMatch: (enableAutoMatch) => set({ enableAutoMatch }),
  setAutoMatchFavorites: (autoMatchFavorites) => set({ autoMatchFavorites }),
  setAutoMatchPlaylists: (autoMatchPlaylists) => set({ autoMatchPlaylists }),
  setAutoMatchContext: (autoMatchContext) => set({ autoMatchContext }),
  setEnableProxyFallback: (enableProxyFallback) => set({ enableProxyFallback }),
  setBilibiliKeepOriginalMeta: (bilibiliKeepOriginalMeta) =>
    set({ bilibiliKeepOriginalMeta }),
  setBilibiliAutoMatchSuffix: (bilibiliAutoMatchSuffix) =>
    set({ bilibiliAutoMatchSuffix }),
  setFullScreenBackgroundMode: (fullScreenBackgroundMode) =>
    set({ fullScreenBackgroundMode }),
  setShowSourceBadge: (showSourceBadge) => set({ showSourceBadge }),
  setLyricAlign: (lyricAlign) => set({ lyricAlign }),
  setLyricFontSize: (lyricFontSize) => set({ lyricFontSize }),
  setLyricOffset: (lyricOffset) => set({ lyricOffset }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setIsFullScreenPlayer: (isFullScreenPlayer) => set({ isFullScreenPlayer }),
});
