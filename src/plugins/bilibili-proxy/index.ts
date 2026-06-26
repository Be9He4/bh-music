import { registerPlugin } from "@capacitor/core";

export interface BilibiliProxyPlugin {
  /**
   * 启动本地代理服务器
   */
  startServer(): Promise<{ success: boolean; port: number }>;

  /**
   * 停止本地代理服务器
   */
  stopServer(): Promise<{ success: boolean }>;

  /**
   * 获取代理URL
   */
  getProxyUrl(options: {
    audioUrl: string;
    bvid: string;
  }): Promise<{ success: boolean; url: string }>;

  /**
   * 检查服务器是否运行中
   */
  isRunning(): Promise<{ running: boolean; port?: number }>;
}

export const BilibiliProxy = registerPlugin<BilibiliProxyPlugin>("BilibiliProxy");
