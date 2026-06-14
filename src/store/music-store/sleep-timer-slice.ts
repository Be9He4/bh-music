import type { StateCreator } from "zustand";
import type { MusicState } from "./types";

export interface SleepTimerSlice {
  sleepTimerDuration: number;
  sleepTimerRemaining: number;
  sleepTimerIsActive: boolean;
  sleepTimerEndTime: number;
  setSleepTimerDuration: (duration: number) => void;
  setSleepTimerRemaining: (remaining: number) => void;
  setSleepTimerIsActive: (isActive: boolean) => void;
  setSleepTimerEndTime: (endTime: number) => void;
}

export const createSleepTimerSlice: StateCreator<
  MusicState,
  [],
  [],
  SleepTimerSlice
> = (set) => ({
  sleepTimerDuration: 30,
  sleepTimerRemaining: 0,
  sleepTimerIsActive: false,
  sleepTimerEndTime: 0,
  setSleepTimerDuration: (sleepTimerDuration) => set({ sleepTimerDuration }),
  setSleepTimerRemaining: (sleepTimerRemaining) => set({ sleepTimerRemaining }),
  setSleepTimerIsActive: (sleepTimerIsActive) => set({ sleepTimerIsActive }),
  setSleepTimerEndTime: (sleepTimerEndTime) => set({ sleepTimerEndTime }),
});
