import { Clipboard } from "@capacitor/clipboard";
import { Capacitor } from "@capacitor/core";
import { logger } from "./logger";

/**
 * 跨平台读取剪贴板文本
 * - Web 端使用 navigator.clipboard.readText()
 * - Capacitor APP 端使用 @capacitor/clipboard 插件
 *
 * @returns 剪贴板文本内容，读取失败返回空字符串
 */
export async function readClipboardText(): Promise<string> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { value } = await Clipboard.read();
      return value || "";
    } else {
      return (await navigator.clipboard?.readText?.()) || "";
    }
  } catch (error) {
    logger.warn("clipboard", "Failed to read clipboard", error);
    return "";
  }
}

/**
 * 跨平台写入剪贴板文本
 * - Web 端使用 navigator.clipboard.writeText()
 * - Capacitor APP 端使用 @capacitor/clipboard 插件
 *
 * @param text 要写入剪贴板的文本内容
 * @returns 是否写入成功
 */
export async function writeClipboardText(text: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Clipboard.write({ string: text });
      return true;
    } else {
      await navigator.clipboard?.writeText?.(text);
      return true;
    }
  } catch (error) {
    logger.warn("clipboard", "Failed to write clipboard", error);
    return false;
  }
}
