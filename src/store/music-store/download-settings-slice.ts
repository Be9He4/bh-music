import type { StateCreator } from "zustand";
import type { MusicState } from "./types";

export interface DownloadSettingsSlice {
  downloadQuality: string;
  embedCover: boolean;
  embedLyric: boolean;
  downloadDirectory: string;
  setDownloadQuality: (quality: string) => void;
  setEmbedCover: (embed: boolean) => void;
  setEmbedLyric: (embed: boolean) => void;
  setDownloadDirectory: (dir: string) => void;
}

export const createDownloadSettingsSlice: StateCreator<
  MusicState,
  [],
  [],
  DownloadSettingsSlice
> = (set) => ({
  downloadQuality: "320",
  embedCover: true,
  embedLyric: true,
  downloadDirectory: "",
  setDownloadQuality: (downloadQuality) => set({ downloadQuality }),
  setEmbedCover: (embedCover) => set({ embedCover }),
  setEmbedLyric: (embedLyric) => set({ embedLyric }),
  setDownloadDirectory: (downloadDirectory) => set({ downloadDirectory }),
});
