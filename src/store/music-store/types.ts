import type { FavoritesSlice } from "./favorites-slice";
import type { PlaylistSlice } from "./playlist-slice";
import type { PlaybackSlice } from "./playback-slice";
import type { SearchSlice } from "./search-slice";
import type { UiSlice } from "./ui-slice";
import type { DownloadSettingsSlice } from "./download-settings-slice";
import type { SleepTimerSlice } from "./sleep-timer-slice";

export type MusicState = FavoritesSlice &
  PlaylistSlice &
  PlaybackSlice &
  SearchSlice &
  UiSlice &
  DownloadSettingsSlice &
  SleepTimerSlice;

export type { FullScreenBackgroundMode } from "./ui-slice";
