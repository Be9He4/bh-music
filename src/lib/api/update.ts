import { getApiUrl, fetchWithTimeout, unwrap } from "./config";

const updateUrl = () => `${getApiUrl()}/update`;

export interface UpdateInfo {
  latestVersion: string;
  changelog: string;
  downloadUrl: string;
  directUrl: string;
  publishDate: string;
  size: number;
}

/**
 * 检查更新
 */
export async function checkUpdate(): Promise<UpdateInfo> {
  return unwrap<UpdateInfo>(
    fetchWithTimeout(`${updateUrl()}/check`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })
  );
}
