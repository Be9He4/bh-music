import { useState, useEffect, useRef, useCallback } from "react";
import type { MusicTrack } from "@/types/music";

interface DetailPageState<T> {
  loading: boolean;
  error: boolean;
  detail: T | null;
  tracks: MusicTrack[];
}

export interface UseDetailPageResult<T> {
  loading: boolean;
  error: boolean;
  detail: T | null;
  tracks: MusicTrack[];
  setDetail: (updater: T | null | ((prev: T | null) => T | null)) => void;
  setTracks: (
    updater: MusicTrack[] | ((prev: MusicTrack[]) => MusicTrack[])
  ) => void;
  retry: () => void;
}

export function useDetailPage<T>(
  fetchFn: (signal: AbortSignal) => Promise<{
    detail: T;
    tracks: MusicTrack[];
  }>,
  deps: unknown[]
): UseDetailPageResult<T> {
  const [state, setState] = useState<DetailPageState<T>>({
    loading: true,
    error: false,
    detail: null,
    tracks: [],
  });
  const [retryCount, setRetryCount] = useState(0);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const retry = useCallback(() => setRetryCount((c) => c + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    const run = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: false }));
        const result = await fetchFnRef.current(controller.signal);
        if (controller.signal.aborted) return;
        setState({
          loading: false,
          error: false,
          detail: result.detail,
          tracks: result.tracks,
        });
      } catch {
        if (controller.signal.aborted) return;
        setState((prev) => ({ ...prev, loading: false, error: true }));
      }
    };

    run();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount, ...deps]);

  const setDetail = useCallback(
    (updater: T | null | ((prev: T | null) => T | null)) => {
      setState((prev) => ({
        ...prev,
        detail:
          typeof updater === "function"
            ? (updater as (prev: T | null) => T | null)(prev.detail)
            : updater,
      }));
    },
    []
  );

  const setTracks = useCallback(
    (updater: MusicTrack[] | ((prev: MusicTrack[]) => MusicTrack[])) => {
      setState((prev) => ({
        ...prev,
        tracks:
          typeof updater === "function"
            ? (updater as (prev: MusicTrack[]) => MusicTrack[])(prev.tracks)
            : updater,
      }));
    },
    []
  );

  return { ...state, setDetail, setTracks, retry };
}
