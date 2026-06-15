import { useState, useEffect } from "react";
import { Network } from "@capacitor/network";
import { IS_NATIVE } from "@/lib/api/config";

/**
 * 网络状态钩子
 * 仅依赖设备网络状态，不做服务器可达性探测
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    IS_NATIVE ? true : navigator.onLine
  );

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

    let cancelled = false;
    let listener: Awaited<ReturnType<typeof Network.addListener>> | null = null;

    Network.getStatus().then((status) => {
      if (!cancelled) setIsOnline(status.connected);
    });

    Network.addListener("networkStatusChange", (status) => {
      if (!cancelled) setIsOnline(status.connected);
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, []);

  return isOnline;
}
