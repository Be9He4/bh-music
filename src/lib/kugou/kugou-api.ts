import type { MusicTrack } from '@/types/music';
import { getApiUrl, IS_NATIVE, IS_WEB_PROD } from '@/lib/api/config';
import forge from 'node-forge/lib/forge';
import 'node-forge/lib/md5';
import 'node-forge/lib/pki';
import 'node-forge/lib/cipher';
import 'node-forge/lib/util';
import type {
  KugouGlobalPlaylistInfoResponse,
  KugouGlobalPlaylistSongsResponse,
  KugouPlaylistDetail,
  KugouPlaylistResponse,
  KugouSongRaw,
} from './kugou-types';

const KUGOU_PROXY_PREFIX = '/music-api/kugou';
const KUGOU_PAGE_SIZE = 100;
const NETWORK_TIMEOUT = 12000;
const KUGOU_ANDROID_SIGN_KEY = 'OIlwieks28dk2k092lksi2UIkp';
const DEVICE_MID_STORAGE_KEY = 'otter_kugou_device_mid';
const DEVICE_DFID_STORAGE_KEY = 'otter_kugou_device_dfid';
const KUGOU_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDIAG7QOELSYoIJvTFJhMpe1s/g
bjDJX51HBNnEl5HXqTW6lQ7LC8jr9fWZTwusknp+sVGzwd40MwP6U5yDE27M/X1+
UR4tvOGOqp94TJtQ1EPnWGWXngpeIW5GxoQGao1rmYWAu6oi1z9XkChrsUdC6DJE
5E221wf/4WLFxwAtRQIDAQAB
-----END PUBLIC KEY-----`;

function getDeviceMid(): string {
  try {
    const stored = localStorage.getItem(DEVICE_MID_STORAGE_KEY);
    if (stored) return stored;
  } catch { /* localStorage not available */ }
  const mid = crypto.randomUUID().replace(/-/g, '');
  try { localStorage.setItem(DEVICE_MID_STORAGE_KEY, mid); } catch { /* ignore */ }
  return mid;
}

function getDeviceDfid(): string | null {
  try { return localStorage.getItem(DEVICE_DFID_STORAGE_KEY); } catch { return null; }
}

function saveDeviceDfid(dfid: string): void {
  try { localStorage.setItem(DEVICE_DFID_STORAGE_KEY, dfid); } catch { /* ignore */ }
}

function md5Hex(s: string): string {
  return forge.md5.create().update(forge.util.encodeUtf8(s)).digest().toHex();
}

const DEVICE_MID = getDeviceMid();
const DEVICE_DFID = getDeviceDfid() || '-';
const KUGOU_ANDROID_DEFAULT_PARAMS = {
  appid: 1005,
  clientver: 20489,
  dfid: DEVICE_DFID,
  mid: DEVICE_MID,
  uuid: '-',
};

/**
 * 注册酷狗设备，获取有效 dfid。
 * 参考 MakcRe/KuGouMusicApi register_dev.js
 */
async function registerKugouDevice(): Promise<string> {
  const randomKey = Array.from({ length: 6 }, () =>
    'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)],
  ).join('');
  const encryptKey = md5Hex(randomKey).substring(0, 16);
  const iv = md5Hex(randomKey).substring(16, 32);

  const deviceParams = {
    availableRamSize: 4983533568,
    availableRomSize: 48114719,
    availableSDSize: 48114717,
    basebandVer: '',
    batteryLevel: 100,
    batteryStatus: 3,
    brand: 'Xiaomi',
    buildSerial: 'unknown',
    device: 'marble',
    imei: DEVICE_MID.substring(0, 15),
    imsi: '',
    manufacturer: 'Xiaomi',
    uuid: DEVICE_MID,
    accelerometer: false, accelerometerValue: '',
    gravity: false, gravityValue: '',
    gyroscope: false, gyroscopeValue: '',
    light: false, lightValue: '',
    magnetic: false, magneticValue: '',
    orientation: false, orientationValue: '',
    pressure: false, pressureValue: '',
    step_counter: false, step_counterValue: '',
    temperature: false, temperatureValue: '',
  };

  const cipher = forge.cipher.createCipher('AES-CBC', encryptKey);
  cipher.start({ iv });
  cipher.update(forge.util.createBuffer(JSON.stringify(deviceParams), 'utf8'));
  cipher.finish();
  const body = forge.util.encode64(cipher.output.getBytes());

  const pki = forge.pki.publicKeyFromPem(KUGOU_RSA_PUBLIC_KEY);
  const rsaInput = JSON.stringify({ aes: randomKey, uid: '0', token: '' });
  const rsaEncrypted = pki.encrypt(forge.util.encodeUtf8(rsaInput), 'RSAES-PKCS1-V1_5');
  const p = forge.util.bytesToHex(rsaEncrypted);

  const ct = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number> = {
    appid: 1005, clientver: 20489, dfid: '-', mid: DEVICE_MID, uuid: '-', clienttime: ct,
    part: 1, platid: 1, p,
  };
  const paramsStr = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('');
  const signature = md5Hex(`${KUGOU_ANDROID_SIGN_KEY}${paramsStr}${body}${KUGOU_ANDROID_SIGN_KEY}`);

  const sp = new URLSearchParams();
  Object.entries({ ...params, signature }).forEach(([k, v]) => sp.set(k, String(v)));

  const res = await fetch(`/api/kugou-register/risk/v2/r_register_dev?${sp.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
      'dfid': '-', 'mid': DEVICE_MID, 'clienttime': String(ct),
      'kg-rc': '1', 'kg-thash': '5d816a0', 'kg-rec': '1', 'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
    },
    body,
  });

  if (!res.ok) throw new Error(`设备注册失败: ${res.status}`);

  const raw = new Uint8Array(await res.arrayBuffer());
  const decipher = forge.cipher.createDecipher('AES-CBC', encryptKey);
  decipher.start({ iv });
  decipher.update(forge.util.createBuffer(Array.from(raw).map((b) => String.fromCharCode(b)).join(''), 'raw'));
  decipher.finish();
  const data = JSON.parse(decipher.output.toString());

  if (data.status !== 1 || !data.data?.dfid) {
    throw new Error('设备注册失败: 未获取到 dfid');
  }

  return data.data.dfid;
}

/**
 * 获取或注册设备 dfid。
 */
async function ensureDeviceDfid(): Promise<string> {
  const stored = getDeviceDfid();
  if (stored) return stored;
  const dfid = await registerKugouDevice();
  saveDeviceDfid(dfid);
  return dfid;
}

/**
 * 从酷狗歌单分享链接中提取歌单 ID。
 */
export function parseKugouPlaylistUrl(urlStr: string): string | null {
  try {
    const url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    const pathMatch = url.pathname.match(/(?:special\/single|plist\/list)\/(\d+)/);
    if (pathMatch) return pathMatch[1];

    const globalPathMatch = url.pathname.match(/\/songlist\/(gcid_[a-z0-9]+)\/?/i);
    if (globalPathMatch) return globalPathMatch[1];

    const idParam = url.searchParams.get('specialid') || url.searchParams.get('id');
    if (idParam && /^\d+$/.test(idParam)) return idParam;
    if (idParam && /^gcid_[a-z0-9]+$/i.test(idParam)) return idParam;

    const qrcode = url.searchParams.get('qrcode');
    if (qrcode) return parseKugouPlaylistUrl(decodeURIComponent(qrcode));

    const globalIdParam = url.searchParams.get('global_collection_id');
    return globalIdParam && /^gcid_[a-z0-9]+$/i.test(globalIdParam) ? globalIdParam : null;
  } catch {
    return null;
  }
}

/**
 * 解析酷狗短链接，跟随重定向获取真实 URL 后提取歌单 ID。
 */
export async function resolveKugouPlaylistId(urlStr: string): Promise<string | null> {
  try {
    const url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`);
    if (/^t\d+\.kugou\.com$/.test(url.hostname)) {
      const endpoint = (!IS_WEB_PROD && !IS_NATIVE)
        ? `/api/kugou-resolve${url.pathname}${url.search}`
        : `${getApiUrl()}${KUGOU_PROXY_PREFIX}/resolve-shortlink`;

      const isDevProxy = (!IS_WEB_PROD && !IS_NATIVE);
      const res = isDevProxy
        ? await fetch(endpoint)
        : await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url.toString() }),
          });

      if (!res.ok) return null;
      const data = await res.json() as { resolvedUrl?: string };
      return data.resolvedUrl ? parseKugouPlaylistUrl(data.resolvedUrl) : null;
    }
    return parseKugouPlaylistUrl(urlStr);
  } catch {
    return null;
  }
}

/**
 * 构建酷狗公开歌单歌曲分页接口路径。
 */
export function buildKugouPlaylistApiPath(playlistId: string, page: number, pageSize = KUGOU_PAGE_SIZE): string {
  return `/api/v3/special/song?plat=0&specialid=${encodeURIComponent(playlistId)}&page=${page}&pagesize=${pageSize}&version=8352&with_res_tag=1`;
}

/**
 * 将酷狗歌曲对象转换为应用内部 MusicTrack。
 */
export function convertKugouSongToMusicTrack(song: KugouSongRaw): MusicTrack {
  const rawId = song.hash || song.HASH || song.audio_id || song.album_audio_id || song.songname || song.filename || 'unknown';
  const artists = normalizeArtists(song);
  const name = song.songname || song.audio_name || stripArtistsFromFilename(song.filename || '', artists) || '未知歌曲';
  const coverUrl = song.trans_param?.union_cover?.replace('{size}', '300') || '';

  return {
    id: `kugou_${rawId}`,
    name,
    artist: artists.length ? artists : ['未知歌手'],
    album: song.album_name || song.albumname || '',
    pic_id: coverUrl,
    url_id: String(rawId),
    lyric_id: String(rawId),
    source: 'kugou',
  };
}

/**
 * 获取酷狗公开歌单详情。
 */
export async function getKugouPlaylistDetail(playlistId: string): Promise<KugouPlaylistDetail> {
  if (IS_WEB_PROD) {
    const res = await fetchWithTimeout(`${getApiUrl()}${KUGOU_PROXY_PREFIX}/playlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlistId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || `API error: ${res.status}`);
    }
    return res.json();
  }

  if (isKugouGlobalCollectionId(playlistId)) {
    return getKugouGlobalPlaylistDetail(playlistId);
  }

  if (IS_NATIVE) {
    const { CapacitorHttp } = await import('@capacitor/core');
    const detail = await fetchKugouPlaylistPages(playlistId, async (path) => {
      const res = await CapacitorHttp.request({
        method: 'GET',
        url: `http://mobilecdn.kugou.com${path}`,
      });
      if (res.status >= 400) throw new Error(`Kugou API error: ${res.status}`);
      return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    });
    return withKugouPlaylistMeta(playlistId, detail, async (url) => {
      const res = await CapacitorHttp.request({ method: 'GET', url });
      if (res.status >= 400) return null;
      return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    });
  }

  const detail = await fetchKugouPlaylistPages(playlistId, async (path) => {
    const res = await fetchWithTimeout(`/api/kugou${path}`);
    if (!res.ok) throw new Error(`Kugou API error: ${res.status}`);
    return res.text();
  });
  return withKugouPlaylistMeta(playlistId, detail, async (url) => {
    const res = await fetchWithTimeout(`/api/kugou-page/${new URL(url).pathname}`);
    if (!res.ok) return null;
    return res.text();
  });
}

/**
 * 获取酷狗新版 global_collection_id 歌单详情。
 */
async function getKugouGlobalPlaylistDetail(playlistId: string): Promise<KugouPlaylistDetail> {
  const dfid = await ensureDeviceDfid();
  KUGOU_ANDROID_DEFAULT_PARAMS.dfid = dfid;

  if (IS_NATIVE) {
    const { CapacitorHttp } = await import('@capacitor/core');
    return fetchKugouGlobalPlaylistPages(
      playlistId,
      async (url) => {
        const res = await CapacitorHttp.request({
          method: 'GET',
          url,
          headers: buildKugouAndroidHeaders(url),
        });
        if (res.status >= 400) throw new Error(`Kugou API error: ${res.status}`);
        return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      },
      async (url, body) => {
        const res = await CapacitorHttp.request({
          method: 'POST',
          url,
          headers: {
            ...buildKugouAndroidHeaders(url),
            'Content-Type': 'application/json',
          },
          data: JSON.parse(body),
        });
        if (res.status >= 400) return null;
        return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      },
    );
  }

  return fetchKugouGlobalPlaylistPages(
    playlistId,
    async (url) => {
      const parsed = new URL(url);
      const res = await fetchWithTimeout(`/api/kugou-global${parsed.pathname}${parsed.search}`, {
        headers: buildKugouAndroidHeaders(url),
      });
      if (!res.ok) throw new Error(`Kugou API error: ${res.status}`);
      return res.text();
    },
    async (url, body) => {
      const parsed = new URL(url);
      const res = await fetchWithTimeout(`/api/kugou-global${parsed.pathname}${parsed.search}`, {
        method: 'POST',
        headers: {
          ...buildKugouAndroidHeaders(url),
          'Content-Type': 'application/json',
        },
        body,
      });
      if (!res.ok) return null;
      return res.text();
    },
  );
}

/**
 * 按分页拉取酷狗歌单歌曲列表。
 */
export async function fetchKugouPlaylistPages(
  playlistId: string,
  fetchText: (path: string) => Promise<string>,
): Promise<KugouPlaylistDetail> {
  const songs: KugouSongRaw[] = [];
  let total = 0;

  for (let page = 1; page <= 100; page += 1) {
    const response = parseKugouPlaylistResponse(await fetchText(buildKugouPlaylistApiPath(playlistId, page)));
    if (response.status !== 1 || response.errcode !== 0) {
      throw new Error(response.error || '酷狗歌单接口返回异常');
    }

    const pageSongs = response.data?.info || [];
    total = response.data?.total || total;
    songs.push(...pageSongs);

    if (!pageSongs.length || (total > 0 && songs.length >= total)) break;
  }

  if (!songs.length) throw new Error('歌单为空，无法导入');

  return {
    name: `酷狗歌单 ${playlistId}`,
    coverUrl: getPlaylistCoverUrl(songs),
    trackCount: total || songs.length,
    songs,
  };
}

/**
 * 按分页拉取酷狗新版 global_collection_id 歌单歌曲列表。
 */
export async function fetchKugouGlobalPlaylistPages(
  playlistId: string,
  fetchText: (url: string) => Promise<string>,
  fetchInfo?: (url: string, body: string) => Promise<string | null>,
): Promise<KugouPlaylistDetail> {
  const songs: KugouSongRaw[] = [];
  let total = 0;

  for (let page = 1; page <= 100; page += 1) {
    const url = buildKugouGlobalPlaylistSongsUrl(playlistId, page);
    const response = parseKugouGlobalPlaylistSongsResponse(await fetchText(url));
    if (response.status !== 1) {
      throw new Error(response.error || `酷狗歌单接口返回异常: ${response.error_code ?? 'unknown'}`);
    }

    const pageSongs = response.data?.info || response.data?.list || [];
    total = response.data?.total || total;
    songs.push(...pageSongs);

    if (!pageSongs.length || (total > 0 && songs.length >= total)) break;
  }

  if (!songs.length) throw new Error('歌单为空，无法导入');

  const detail: KugouPlaylistDetail = {
    name: `酷狗歌单 ${playlistId}`,
    coverUrl: getPlaylistCoverUrl(songs),
    trackCount: total || songs.length,
    songs,
  };

  return fetchInfo ? withKugouGlobalPlaylistMeta(playlistId, detail, fetchInfo) : detail;
}

/**
 * 解析酷狗接口 JSON，兼容返回体外层 HTML 注释标签。
 */
export function parseKugouPlaylistResponse(text: string): KugouPlaylistResponse {
  const jsonText = text
    .replace(/^<!--KG_TAG_RES_START-->/, '')
    .replace(/<!--KG_TAG_RES_END-->$/, '')
    .trim();
  return JSON.parse(jsonText) as KugouPlaylistResponse;
}

/**
 * 解析酷狗新版歌曲接口 JSON。
 */
export function parseKugouGlobalPlaylistSongsResponse(text: string): KugouGlobalPlaylistSongsResponse {
  return JSON.parse(text) as KugouGlobalPlaylistSongsResponse;
}

/**
 * 解析酷狗新版歌单信息接口 JSON。
 */
export function parseKugouGlobalPlaylistInfoResponse(text: string): KugouGlobalPlaylistInfoResponse {
  return JSON.parse(text) as KugouGlobalPlaylistInfoResponse;
}

/**
 * 从酷狗公开歌单 HTML 中提取标题。
 */
export function parseKugouPlaylistTitle(html: string): string | null {
  const metaMatch = html.match(/<meta\s+name="keywords"\s+content="[^"]*?,([^",]+),/i);
  if (metaMatch?.[1]?.trim()) return decodeHtmlEntities(metaMatch[1].trim());

  const titleMatch = html.match(/<title>(.*?)_精选集_/i);
  return titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1].trim()) : null;
}

/**
 * 用公开页面补充酷狗歌单标题。
 */
async function withKugouPlaylistMeta(
  playlistId: string,
  detail: KugouPlaylistDetail,
  fetchPage: (url: string) => Promise<string | null>,
): Promise<KugouPlaylistDetail> {
  try {
    const html = await fetchPage(`https://www.kugou.com/yy/special/single/${playlistId}.html`);
    const name = html ? parseKugouPlaylistTitle(html) : null;
    return name ? { ...detail, name } : detail;
  } catch {
    return detail;
  }
}

/**
 * 用酷狗新版详情接口补充 global_collection_id 歌单标题和封面。
 */
async function withKugouGlobalPlaylistMeta(
  playlistId: string,
  detail: KugouPlaylistDetail,
  fetchInfo: (url: string, body: string) => Promise<string | null>,
): Promise<KugouPlaylistDetail> {
  try {
    const body = JSON.stringify({
      data: [{ global_collection_id: playlistId }],
      userid: 0,
      token: '',
    });
    const response = parseKugouGlobalPlaylistInfoResponse(
      (await fetchInfo(buildKugouGlobalPlaylistInfoUrl(body), body)) || '',
    );
    const info = response.data?.[0];
    if (!info) return detail;

    return {
      ...detail,
      name: info.name || info.specialname || info.title || detail.name,
      coverUrl: info.img || info.pic || info.cover || info.cover_url || detail.coverUrl,
      trackCount: info.song_count || info.count || detail.trackCount,
    };
  } catch {
    return detail;
  }
}

/**
 * 从歌手字段中得到规范化歌手列表。
 */
function normalizeArtists(song: KugouSongRaw): string[] {
  const fromAuthors = song.authors?.map((item) => item.author_name).filter(Boolean) as string[] | undefined;
  if (fromAuthors?.length) return fromAuthors;

  const raw = song.singername || song.author_name || splitFilename(song.filename || '').artist;
  return raw
    .split(/[、,/&]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

/**
 * 从 “歌手 - 歌曲” 文件名中拆出歌曲名。
 */
function stripArtistsFromFilename(filename: string, artists: string[]): string {
  const parsed = splitFilename(filename);
  if (parsed.title) return parsed.title;
  const prefix = artists.join('、');
  return prefix && filename.startsWith(`${prefix} - `) ? filename.slice(prefix.length + 3) : filename;
}

/**
 * 拆分酷狗 filename 字段。
 */
function splitFilename(filename: string) {
  const [artist, ...titleParts] = filename.split(' - ');
  return { artist: titleParts.length ? artist : '', title: titleParts.join(' - ') };
}

/**
 * 获取歌单封面，优先使用第一首歌的联合封面。
 */
function getPlaylistCoverUrl(songs: KugouSongRaw[]): string {
  return songs.find((song) => song.trans_param?.union_cover)?.trans_param?.union_cover?.replace('{size}', '300') || '';
}

/**
 * 判断是否为酷狗新版 global_collection_id。
 */
function isKugouGlobalCollectionId(playlistId: string): boolean {
  return /^gcid_[a-z0-9]+$/i.test(playlistId);
}

/**
 * 构建酷狗新版歌曲分页接口完整 URL。
 */
export function buildKugouGlobalPlaylistSongsUrl(playlistId: string, page: number, pageSize = KUGOU_PAGE_SIZE): string {
  const params = {
    ...KUGOU_ANDROID_DEFAULT_PARAMS,
    clienttime: Math.floor(Date.now() / 1000),
    area_code: 1,
    begin_idx: (page - 1) * pageSize,
    plat: 1,
    type: 1,
    mode: 1,
    personal_switch: 1,
    extend_fields: 'abtags,hot_cmt,popularization',
    pagesize: pageSize,
    global_collection_id: playlistId,
  };
  return buildKugouAndroidSignedUrl('https://gateway.kugou.com/pubsongs/v2/get_other_list_file_nofilt', params);
}

/**
 * 构建酷狗新版歌单信息接口完整 URL。
 */
function buildKugouGlobalPlaylistInfoUrl(body: string): string {
  const params = {
    ...KUGOU_ANDROID_DEFAULT_PARAMS,
    clienttime: Math.floor(Date.now() / 1000),
  };
  return buildKugouAndroidSignedUrl('https://gateway.kugou.com/v3/get_list_info', params, body);
}

/**
 * 构建酷狗 Android 签名 URL。
 */
export function buildKugouAndroidSignedUrl(
  baseUrl: string,
  params: Record<string, string | number>,
  body = '',
): string {
  const signature = signKugouAndroidParams(params, body);
  const searchParams = new URLSearchParams();
  Object.entries({ ...params, signature }).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });
  return `${baseUrl}?${searchParams.toString()}`;
}

/**
 * 生成酷狗 Android API 签名。
 */
export function signKugouAndroidParams(params: Record<string, string | number>, body = ''): string {
  const paramsString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('');
  return forge.md5
    .create()
    .update(forge.util.encodeUtf8(`${KUGOU_ANDROID_SIGN_KEY}${paramsString}${body}${KUGOU_ANDROID_SIGN_KEY}`))
    .digest()
    .toHex();
}

/**
 * 构建酷狗 Android API 请求头。
 */
function buildKugouAndroidHeaders(url: string): Record<string, string> {
  const params = new URL(url).searchParams;
  return {
    'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
    dfid: params.get('dfid') || DEVICE_DFID,
    mid: params.get('mid') || DEVICE_MID,
    clienttime: params.get('clienttime') || String(Math.floor(Date.now() / 1000)),
    'kg-rc': '1',
    'kg-thash': '5d816a0',
    'kg-rec': '1',
    'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
  };
}

/**
 * 解码标题中的基础 HTML 实体。
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = NETWORK_TIMEOUT) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}
