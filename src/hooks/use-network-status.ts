import { useState, useEffect } from "react";
import { Network } from "@capacitor/network";
import { CapacitorHttp } from "@capacitor/core";
import { getApiUrl, IS_NATIVE } from "@/lib/api/config";

const REACHABILITY_TIMEOUT_MS = 3000;

/**
 * 验证设备是否真正可达互联网
 * 用于修正 Capacitor Network 把有网卡但无流量的状态误判为在线的问题
 */
async function checkReachable(): Promise<boolean> {
  try {
    const res = await CapacitorHttp.request({
      method: "HEAD",
      url: `${getApiUrl()}/health`,
      connectTimeout: REACHABILITY_TIMEOUT_MS,
      readTimeout: REACHABILITY_TIMEOUT_MS,
    });
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

/**
 * 网络状态钩子
 * Web 端依赖 navigator.onLine；原生端在 Network 状态为 connected 时额外探测一次可达性，
 * 以识别 VPN/有网卡但无互联网的场景。
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
    let checkSeq = 0;

    const updateOnline = async (connected: boolean) => {
      if (cancelled) return;
      const seq = ++checkSeq;
      const next = connected && (await checkReachable());
      if (cancelled || seq !== checkSeq) return;
      setIsOnline(next);
    };

    Network.getStatus().then((status) => {
      updateOnline(status.connected);
    });

    Network.addListener("networkStatusChange", (status) => {
      updateOnline(status.connected);
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
