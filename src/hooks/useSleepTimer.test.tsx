import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { useSleepTimer } from "./useSleepTimer";
import { useMusicStore } from "@/store/music-store";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("useSleepTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    useMusicStore.setState({
      isPlaying: true,
      volume: 0.8,
      sleepTimerDuration: 30,
      sleepTimerRemaining: 0,
      sleepTimerIsActive: false,
      sleepTimerEndTime: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setup = () => {
    const audio = document.createElement("audio");
    audio.volume = 0.8;
    const audioRef = {
      current: audio,
    } as React.RefObject<HTMLAudioElement | null>;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    let hookResult: ReturnType<typeof useSleepTimer> | null = null;

    function TestHarness() {
      // eslint-disable-next-line react-hooks/globals
      hookResult = useSleepTimer(audioRef);
      return null;
    }

    act(() => {
      root.render(<TestHarness />);
    });

    const cleanup = () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    };

    return { audio, result: () => hookResult!, cleanup };
  };

  it("should start timer with correct duration", () => {
    const { result, cleanup } = setup();

    act(() => {
      result().startTimer(10);
    });

    const state = useMusicStore.getState();
    expect(state.sleepTimerIsActive).toBe(true);
    expect(state.sleepTimerDuration).toBe(10);
    expect(state.sleepTimerRemaining).toBe(600);
    expect(state.sleepTimerEndTime).toBeGreaterThan(Date.now());
    cleanup();
  });

  it("should countdown every second while playing", () => {
    const { result, cleanup } = setup();

    act(() => {
      result().startTimer(5);
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(useMusicStore.getState().sleepTimerRemaining).toBe(297);
    cleanup();
  });

  it("should continue countdown when playback pauses", () => {
    const { result, cleanup } = setup();

    act(() => {
      result().startTimer(5);
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const remainingBeforePause = useMusicStore.getState().sleepTimerRemaining;

    act(() => {
      useMusicStore.setState({ isPlaying: false });
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(useMusicStore.getState().sleepTimerRemaining).toBe(
      remainingBeforePause - 3
    );
    cleanup();
  });

  it("should resume countdown when playback resumes", () => {
    const { result, cleanup } = setup();

    act(() => {
      result().startTimer(5);
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      useMusicStore.setState({ isPlaying: false });
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    act(() => {
      useMusicStore.setState({ isPlaying: true });
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(useMusicStore.getState().sleepTimerRemaining).toBeLessThan(298);
    cleanup();
  });

  it("should cancel timer and reset state", () => {
    const { result, cleanup } = setup();

    act(() => {
      result().startTimer(10);
    });

    act(() => {
      result().cancelTimer();
    });

    const state = useMusicStore.getState();
    expect(state.sleepTimerIsActive).toBe(false);
    expect(state.sleepTimerRemaining).toBe(0);
    expect(state.sleepTimerEndTime).toBe(0);
    cleanup();
  });

  it("should format remaining time correctly", () => {
    const { result, cleanup } = setup();

    act(() => {
      result().startTimer(5);
    });

    expect(result().formattedRemaining).toBe("05:00");

    act(() => {
      vi.advanceTimersByTime(65000);
    });

    expect(result().formattedRemaining).toBe("03:55");
    cleanup();
  });

  it("should fade out and stop before timer reaches zero", () => {
    const { audio, result, cleanup } = setup();

    act(() => {
      result().startTimer(1);
    });

    const volumeBefore = audio.volume;

    // 快进51秒，此时剩余9秒，fade 已提前启动并运行
    act(() => {
      vi.advanceTimersByTime(51000);
    });

    // fade 开始后 audio.volume 应已下降
    expect(audio.volume).toBeLessThan(volumeBefore);

    // 快进9秒到0秒，fade 应刚好完成
    act(() => {
      vi.advanceTimersByTime(9000);
    });

    const state = useMusicStore.getState();
    expect(state.sleepTimerIsActive).toBe(false);
    expect(state.isPlaying).toBe(false);
    cleanup();
  });
});
