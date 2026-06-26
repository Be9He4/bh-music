import { BilibiliProxy } from "@/plugins/bilibili-proxy";
import { Capacitor } from "@capacitor/core";
import { logger } from "@/lib/logger";

let serverStarted = false;
let serverStartPromise: Promise<void> | null = null;

const SERVER_START_TIMEOUT = 8000;

/**
 * 确保本地代理服务器已启动
 */
async function ensureServerRunning(): Promise<void> {
  if (serverStarted) return;

  if (serverStartPromise) {
    return serverStartPromise;
  }

  serverStartPromise = (async () => {
    try {
      const status = await BilibiliProxy.isRunning();
      if (status.running) {
        serverStarted = true;
        logger.info("[bilibili-native] Proxy server already running on port", status.port);
        return;
      }

      const result = await Promise.race([
        BilibiliProxy.startServer(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Server start timeout")), SERVER_START_TIMEOUT)
        ),
      ]);

      if (result.success) {
        serverStarted = true;
        logger.info("[bilibili-native] Proxy server started on port", result.port);
      } else {
        throw new Error("Failed to start proxy server");
      }
    } finally {
      serverStartPromise = null;
    }
  })();

  return serverStartPromise;
}

/**
 * 获取B站音频的本地代理播放URL
 * 实现真正的流式播放，无需等待完整下载
 */
export async function getNativeBilibiliStreamUrl(
  audioUrl: string,
  bvid: string
): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("This function is only for native platforms");
  }

  try {
    // 确保代理服务器运行
    await ensureServerRunning();

    // 获取代理URL
    const result = await BilibiliProxy.getProxyUrl({ audioUrl, bvid });
    if (result.success) {
      logger.info("[bilibili-native] Got proxy URL for stream playback");
      return result.url;
    }

    logger.error("[bilibili-native] Failed to get proxy URL");
    return null;
  } catch (e) {
    logger.error("[bilibili-native] Error getting stream URL:", e);
    return null;
  }
}

/**
 * 停止代理服务器（应用退出时调用）
 */
export async function stopBilibiliProxyServer(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await BilibiliProxy.stopServer();
    serverStarted = false;
    logger.info("[bilibili-native] Proxy server stopped");
  } catch (e) {
    logger.error("[bilibili-native] Error stopping proxy server:", e);
  }
}
