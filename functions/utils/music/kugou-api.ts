import {
  buildKugouAndroidHeaders,
  buildKugouDeviceRegistrationPayload,
  buildKugouPlaylistApiPath,
  convertKugouSongToMusicTrack,
  fetchKugouGlobalPlaylistPages,
  fetchKugouPlaylistPages,
  isKugouGlobalCollectionId,
  KUGOU_ANDROID_SIGN_KEY,
  KUGOU_PAGE_SIZE,
  KUGOU_RSA_PUBLIC_KEY,
  md5Hex,
  parseKugouDeviceRegistrationResponse,
  parseKugouGlobalPlaylistSongsResponse,
  parseKugouPlaylistResponse,
  withKugouPlaylistMeta,
  buildKugouGlobalPlaylistInfoUrl,
  parseKugouGlobalPlaylistInfoResponse,
  parseKugouPlaylistTitle,
} from '@otter-music/shared';
import type { KugouPlaylistDetail, KugouSongRaw, KugouGlobalPlaylistInfoResponse } from '@otter-music/shared';

export { KUGOU_PAGE_SIZE, convertKugouSongToMusicTrack };

const KUGOU_BASE_URL = 'http://mobilecdn.kugou.com';
const DEVICE_MID = crypto.randomUUID().replace(/-/g, '');
let DEVICE_DFID = '-';

async function registerServerDevice(): Promise<string> {
  const payload = buildKugouDeviceRegistrationPayload(DEVICE_MID);

  const res = await fetch(payload.url, {
    method: 'POST',
    headers: payload.headers,
    body: payload.body,
  });

  if (!res.ok) throw new Error(`Kugou device register failed: ${res.status}`);

  const raw = new Uint8Array(await res.arrayBuffer());
  const { dfid } = parseKugouDeviceRegistrationResponse(raw, payload.encryptKey, payload.iv);
  return dfid;
}

// ============================================================
// 歌单获取（直接 fetch + 调用 shared 核心算法）
// ============================================================

export async function fetchKugouPlaylistDetail(playlistId: string): Promise<KugouPlaylistDetail> {
  if (isKugouGlobalCollectionId(playlistId)) {
    if (DEVICE_DFID === '-') {
      DEVICE_DFID = await registerServerDevice();
    }

    return fetchKugouGlobalPlaylistPages(
      playlistId, DEVICE_DFID, DEVICE_MID,
      async (url) => {
        const res = await fetch(url, { headers: buildKugouAndroidHeaders(url, DEVICE_DFID, DEVICE_MID) });
        if (!res.ok) throw new Error(`Kugou API error: ${res.status}`);
        return res.text();
      },
      async (url, body) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { ...buildKugouAndroidHeaders(url, DEVICE_DFID, DEVICE_MID), 'Content-Type': 'application/json' },
          body,
        });
        if (!res.ok) return null;
        return res.text();
      },
    );
  }

  const detail = await fetchKugouPlaylistPages(playlistId, async (path) => {
    const res = await fetch(`${KUGOU_BASE_URL}${path}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) throw new Error(`Kugou API error: ${res.status}`);
    return res.text();
  });
  return withKugouPlaylistMeta(playlistId, detail, async (url) => {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return null;
    return res.text();
  });
}

// ============================================================
// 短链解析
// ============================================================

export async function resolveKugouShortUrl(shortUrl: string): Promise<string | null> {
  const res = await fetch(shortUrl, { method: 'HEAD', redirect: 'manual' });
  return res.headers.get('location');
}
