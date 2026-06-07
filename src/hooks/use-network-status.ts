import { useState, useEffect } from "react";
import { Network } from "@capacitor/network";
import { IS_NATIVE } from "@/lib/api/config";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (!IS_NATIVE) {
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }

    let listener: Awaited<ReturnType<typeof Network.addListener>> | null = null;

    Network.getStatus().then((status) => setIsOnline(status.connected));

    Network.addListener("networkStatusChange", (status) => {
      setIsOnline(status.connected);
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      listener?.remove();
    };
  }, []);

  return isOnline;
}
