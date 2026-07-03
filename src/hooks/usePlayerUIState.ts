import { useState, useEffect } from "react";

export function usePlayerUIState(isFullScreen: boolean) {
  const [showLyrics, setShowLyrics] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [qualityDrawerOpen, setQualityDrawerOpen] = useState(false);
  const [speedDrawerOpen, setSpeedDrawerOpen] = useState(false);
  const [sleepDrawerOpen, setSleepDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isFullScreen) {
      const timer = setTimeout(() => setShowLyrics(false), 500);
      return () => clearTimeout(timer);
    }
  }, [isFullScreen]);

  return {
    showLyrics,
    setShowLyrics,
    moreDrawerOpen,
    setMoreDrawerOpen,
    isAddToPlaylistOpen,
    setIsAddToPlaylistOpen,
    qualityDrawerOpen,
    setQualityDrawerOpen,
    speedDrawerOpen,
    setSpeedDrawerOpen,
    sleepDrawerOpen,
    setSleepDrawerOpen,
  };
}
