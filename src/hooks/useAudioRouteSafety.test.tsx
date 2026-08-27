import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { useAudioRouteSafety } from "./useAudioRouteSafety";
import { useMusicStore } from "@/store/music-store";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

const audioRouteMocks = vi.hoisted(() => ({
  addListener: vi.fn(),
}));
const capacitorMocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
}));

vi.mock("@capacitor/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@capacitor/core")>();
  return {
    ...actual,
    Capacitor: capacitorMocks,
  };
});

vi.mock("@/plugins/audio-route", () => ({
  AudioRoute: audioRouteMocks,
}));

describe("useAudioRouteSafety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capacitorMocks.isNativePlatform.mockReturnValue(true);
    useMusicStore.setState({ isPlaying: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("pauses playback when the native audio route is lost", async () => {
    let onRouteLost: (() => void) | undefined;
    const remove = vi.fn().mockResolvedValue(undefined);
    audioRouteMocks.addListener.mockImplementation(async (_event, callback) => {
      onRouteLost = callback;
      return { remove };
    });

    const audio = document.createElement("audio");
    const pause = vi.spyOn(audio, "pause").mockImplementation(() => {});
    const audioRef = {
      current: audio,
    } as React.RefObject<HTMLAudioElement | null>;
    const container = document.createElement("div");
    const root = createRoot(container);
    document.body.appendChild(container);

    function TestHarness() {
      useAudioRouteSafety(audioRef);
      return null;
    }

    await act(async () => {
      root.render(<TestHarness />);
    });

    act(() => onRouteLost?.());

    expect(pause).toHaveBeenCalledOnce();
    expect(useMusicStore.getState().isPlaying).toBe(false);

    act(() => root.unmount());
    expect(remove).toHaveBeenCalledOnce();
    container.remove();
  });

  it("does not subscribe on Web", async () => {
    capacitorMocks.isNativePlatform.mockReturnValue(false);
    const audioRef = {
      current: document.createElement("audio"),
    } as React.RefObject<HTMLAudioElement | null>;
    const container = document.createElement("div");
    const root = createRoot(container);

    function TestHarness() {
      useAudioRouteSafety(audioRef);
      return null;
    }

    await act(async () => {
      root.render(<TestHarness />);
    });

    expect(audioRouteMocks.addListener).not.toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });

  it("does not change an already paused player", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const onRouteLost = vi.fn();
    audioRouteMocks.addListener.mockImplementation(async (_event, callback) => {
      onRouteLost.mockImplementation(callback);
      return { remove };
    });
    useMusicStore.setState({ isPlaying: false });

    const audio = document.createElement("audio");
    const audioRef = {
      current: audio,
    } as React.RefObject<HTMLAudioElement | null>;
    const pause = vi.spyOn(audio, "pause").mockImplementation(() => {});
    const container = document.createElement("div");
    const root = createRoot(container);

    function TestHarness() {
      useAudioRouteSafety(audioRef);
      return null;
    }

    await act(async () => {
      root.render(<TestHarness />);
    });
    act(() => onRouteLost());

    expect(pause).not.toHaveBeenCalled();
    expect(useMusicStore.getState().isPlaying).toBe(false);

    act(() => root.unmount());
    container.remove();
  });
});
