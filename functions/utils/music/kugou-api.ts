import * as forge from 'node-forge';
import 'node-forge/lib/md5';

interface KugouPlaylistResponse {
  status: number;
  errcode: number;
  error?: string;
  data?: {
    total?: number;
    info?: KugouSongRaw[];
  };
}

interface KugouGlobalPlaylistSongsResponse {
  status: number;
  error_code?: number;
  error?: string;
  data?: {
    total?: number;
    info?: KugouSongRaw[];
    list?: KugouSongRaw[];
  };
}

interface KugouGlobalPlaylistInfoResponse {
  status: number;
  error_code?: number;
  error?: string;
  data?: Array<{
    name?: string;
    specialname?: string;
    title?: string;
    img?: string;
    pic?: string;
    cover?: string;
    cover_url?: string;
    song_count?: number;
    count?: number;
  }>;
}

interface KugouSongRaw {
  hash?: string;
  HASH?: string;
  audio_id?: number | string;
  album_audio_id?: number | string;
  songname?: string;
  audio_name?: string;
  filename?: string;
  singername?: string;
  author_name?: string;
  authors?: Array<{ author_name?: string }>;
  album_name?: string;
  albumname?: string;
  trans_param?: {
    union_cover?: string;
  };
}

export interface KugouPlaylistDetail {
  name: string;
  coverUrl: string;
  trackCount: number;
  songs: KugouSongRaw[];
}

const KUGOU_BASE_URL = 'http://mobilecdn.kugou.com';
const KUGOU_PAGE_SIZE = 100;
const KUGOU_ANDROID_SIGN_KEY = 'OIlwieks28dk2k092lksi2UIkp';
const DEVICE_MID = crypto.randomUUID().replace(/-/g, '');
const KUGOU_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDIAG7QOELSYoIJvTFJhMpe1s/g
bjDJX51HBNnEl5HXqTW6lQ7LC8jr9fWZTwusknp+sVGzwd40MwP6U5yDE27M/X1+
UR4tvOGOqp94TJtQ1EPnWGWXngpeIW5GxoQGao1rmYWAu6oi1z9XkChrsUdC6DJE
5E221wf/4WLFxwAtRQIDAQAB
-----END PUBLIC KEY-----`;

function md5Hex(s: string): string {
  return forge.md5.create().update(forge.util.encodeUtf8(s)).digest().toHex();
}

let DEVICE_DFID = '-';

async function registerServerDevice(): Promise<string> {
  const randomKey = Array.from({ length: 6 }, () =>
    'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)],
  ).join('');
  const encryptKey = md5Hex(randomKey).substring(0, 16);
  const iv = md5Hex(randomKey).substring(16, 32);

  const deviceParams = {
    availableRamSize: 4983533568, availableRomSize: 48114719, availableSDSize: 48114717,
    basebandVer: '', batteryLevel: 100, batteryStatus: 3,
    brand: 'Xiaomi', buildSerial: 'unknown', device: 'marble',
    imei: DEVICE_MID.substring(0, 15), imsi: '',
    manufacturer: 'Xiaomi', uuid: DEVICE_MID,
    accelerometer: false, accelerometerValue: '', gravity: false, gravityValue: '',
    gyroscope: false, gyroscopeValue: '', light: false, lightValue: '',
    magnetic: false, magneticValue: '', orientation: false, orientationValue: '',
    pressure: false, pressureValue: '', step_counter: false, step_counterValue: '',
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

  const res = await fetch(`https://userservice.kugou.com/risk/v2/r_register_dev?${sp.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
      'dfid': '-', 'mid': DEVICE_MID, 'clienttime': String(ct),
      'kg-rc': '1', 'kg-thash': '5d816a0', 'kg-rec': '1', 'kg-rf': 'B9EDA08A64250DEFFBCADDEE00F8F25F',
    },
    body,
  });

  if (!res.ok) throw new Error(`Kugou device register failed: ${res.status}`);

  const raw = new Uint8Array(await res.arrayBuffer());
  const decipher = forge.cipher.createDecipher('AES-CBC', encryptKey);
  decipher.start({ iv });
  decipher.update(forge.util.createBuffer(Array.from(raw).map((b) => String.fromCharCode(b)).join(''), 'raw'));
  decipher.finish();
  const data = JSON.parse(decipher.output.toString());

  if (data.status !== 1 || !data.data?.dfid) throw new Error('Device register: no dfid returned');

  return data.data.dfid;
}

const KUGOU_ANDROID_DEFAULT_PARAMS = {
  appid: 1005,
  clientver: 20489,
  dfid: DEVICE_DFID,
  mid: DEVICE_MID,
  uuid: '-',
};

/**
 * 构建酷狗公开歌单歌曲分页接口路径。
 */
function buildKugouPlaylistApiPath(playlistId: string, page: number, pageSize = KUGOU_PAGE_SIZE): string {
  return `/api/v3/special/song?plat=0&specialid=${encodeURIComponent(playlistId)}&page=${page}&pagesize=${pageSize}&version=8352&with_res_tag=1`;
}

/**
 * 获取酷狗公开歌单详情。
 */
export async function fetchKugouPlaylistDetail(playlistId: string): Promise<KugouPlaylistDetail> {
  if (isKugouGlobalCollectionId(playlistId)) {
    return fetchKugouGlobalPlaylistDetail(playlistId);
  }

  const songs: KugouSongRaw[] = [];
  let total = 0;

  for (let page = 1; page <= 100; page += 1) {
    const res = await fetch(`${KUGOU_BASE_URL}${buildKugouPlaylistApiPath(playlistId, page)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) throw new Error(`Kugou API error: ${res.status}`);

    const response = parseKugouPlaylistResponse(await res.text());
    if (response.status !== 1 || response.errcode !== 0) {
      throw new Error(response.error || '酷狗歌单接口返回异常');
    }

    const pageSongs = response.data?.info || [];
    total = response.data?.total || total;
    songs.push(...pageSongs);

    if (!pageSongs.length || (total > 0 && songs.length >= total)) break;
  }

  if (!songs.length) throw new Error('歌单为空，无法导入');

  const detail = {
    name: `酷狗歌单 ${playlistId}`,
    coverUrl: songs.find((song) => song.trans_param?.union_cover)?.trans_param?.union_cover?.replace('{size}', '300') || '',
    trackCount: total || songs.length,
    songs,
  };

  return withKugouPlaylistMeta(playlistId, detail);
}

/**
 * 获取酷狗新版 global_collection_id 歌单详情。
 */
async function fetchKugouGlobalPlaylistDetail(playlistId: string): Promise<KugouPlaylistDetail> {
  if (DEVICE_DFID === '-') {
    DEVICE_DFID = await registerServerDevice();
    KUGOU_ANDROID_DEFAULT_PARAMS.dfid = DEVICE_DFID;
  }

  const songs: KugouSongRaw[] = [];
  let total = 0;

  for (let page = 1; page <= 100; page += 1) {
    const url = buildKugouGlobalPlaylistSongsUrl(playlistId, page);
    const res = await fetch(url, {
      headers: buildKugouAndroidHeaders(url),
    });
    if (!res.ok) throw new Error(`Kugou API error: ${res.status}`);

    const response = parseKugouGlobalPlaylistSongsResponse(await res.text());
    if (response.status !== 1) {
      throw new Error(response.error || `酷狗歌单接口返回异常: ${response.error_code ?? 'unknown'}`);
    }

    const pageSongs = response.data?.info || response.data?.list || [];
    total = response.data?.total || total;
    songs.push(...pageSongs);

    if (!pageSongs.length || (total > 0 && songs.length >= total)) break;
  }

  if (!songs.length) throw new Error('歌单为空，无法导入');

  const detail = {
    name: `酷狗歌单 ${playlistId}`,
    coverUrl: getPlaylistCoverUrl(songs),
    trackCount: total || songs.length,
    songs,
  };

  return withKugouGlobalPlaylistMeta(playlistId, detail);
}

/**
 * 解析酷狗接口 JSON，兼容返回体外层 HTML 注释标签。
 */
function parseKugouPlaylistResponse(text: string): KugouPlaylistResponse {
  const jsonText = text
    .replace(/^<!--KG_TAG_RES_START-->/, '')
    .replace(/<!--KG_TAG_RES_END-->$/, '')
    .trim();
  return JSON.parse(jsonText) as KugouPlaylistResponse;
}

/**
 * 解析酷狗新版歌曲接口 JSON。
 */
function parseKugouGlobalPlaylistSongsResponse(text: string): KugouGlobalPlaylistSongsResponse {
  return JSON.parse(text) as KugouGlobalPlaylistSongsResponse;
}

/**
 * 用公开页面补充酷狗歌单标题。
 */
async function withKugouPlaylistMeta(playlistId: string, detail: KugouPlaylistDetail): Promise<KugouPlaylistDetail> {
  try {
    const res = await fetch(`https://www.kugou.com/yy/special/single/${playlistId}.html`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return detail;
    const name = parseKugouPlaylistTitle(await res.text());
    return name ? { ...detail, name } : detail;
  } catch {
    return detail;
  }
}

/**
 * 用酷狗新版详情接口补充 global_collection_id 歌单标题和封面。
 */
async function withKugouGlobalPlaylistMeta(playlistId: string, detail: KugouPlaylistDetail): Promise<KugouPlaylistDetail> {
  try {
    const body = JSON.stringify({
      data: [{ global_collection_id: playlistId }],
      userid: 0,
      token: '',
    });
    const url = buildKugouGlobalPlaylistInfoUrl(body);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...buildKugouAndroidHeaders(url),
        'Content-Type': 'application/json',
      },
      body,
    });
    if (!res.ok) return detail;

    const response = JSON.parse(await res.text()) as KugouGlobalPlaylistInfoResponse;
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
 * 从酷狗公开歌单 HTML 中提取标题。
 */
function parseKugouPlaylistTitle(html: string): string | null {
  const metaMatch = html.match(/<meta\s+name="keywords"\s+content="[^"]*?,([^",]+),/i);
  if (metaMatch?.[1]?.trim()) return decodeHtmlEntities(metaMatch[1].trim());

  const titleMatch = html.match(/<title>(.*?)_精选集_/i);
  return titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1].trim()) : null;
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
function buildKugouGlobalPlaylistSongsUrl(playlistId: string, page: number, pageSize = KUGOU_PAGE_SIZE): string {
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
function buildKugouAndroidSignedUrl(baseUrl: string, params: Record<string, string | number>, body = ''): string {
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
function signKugouAndroidParams(params: Record<string, string | number>, body = ''): string {
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
 * 解析酷狗短链接，跟随重定向获取真实 URL。
 */
export async function resolveKugouShortUrl(shortUrl: string): Promise<string | null> {
  const res = await fetch(shortUrl, { method: 'HEAD', redirect: 'manual' });
  return res.headers.get('location');
}

/**
 * 构建酷狗 Android API 请求头。
 */
function buildKugouAndroidHeaders(url: string): Record<string, string> {
  const params = new URL(url).searchParams;
  return {
    'User-Agent': 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi',
    dfid: params.get('dfid') || KUGOU_ANDROID_DEFAULT_PARAMS.dfid,
    mid: params.get('mid') || KUGOU_ANDROID_DEFAULT_PARAMS.mid,
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
