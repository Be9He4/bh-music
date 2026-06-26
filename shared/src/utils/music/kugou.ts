import type { MusicTrack } from "../../types/music";

let _forge: typeof import("node-forge") | null = null;
let _forgePromise: Promise<void> | null = null;
async function ensureForge() {
  if (_forge) return;
  if (!_forgePromise) {
    _forgePromise = import("node-forge").then((m) => {
      _forge = m as typeof import("node-forge");
    });
  }
  await _forgePromise;
}
import type {
  KugouGlobalPlaylistInfoResponse,
  KugouGlobalPlaylistSongsResponse,
  KugouPlaylistDetail,
  KugouPlaylistResponse,
  KugouSongRaw,
} from "../../types/music-platforms";

// ============================================================
// 常量
// ============================================================

export const KUGOU_PAGE_SIZE = 100;
export const KUGOU_ANDROID_SIGN_KEY = "OIlwieks28dk2k092lksi2UIkp";
export const KUGOU_RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDIAG7QOELSYoIJvTFJhMpe1s/g
bjDJX51HBNnEl5HXqTW6lQ7LC8jr9fWZTwusknp+sVGzwd40MwP6U5yDE27M/X1+
UR4tvOGOqp94TJtQ1EPnWGWXngpeIW5GxoQGao1rmYWAu6oi1z9XkChrsUdC6DJE
5E221wf/4WLFxwAtRQIDAQAB
-----END PUBLIC KEY-----`;

// ============================================================
// 纯工具函数
// ============================================================

export async function md5Hex(s: string): Promise<string> {
  await ensureForge();
  return _forge!.md5
    .create()
    .update(_forge!.util.encodeUtf8(s))
    .digest()
    .toHex();
}

export function isKugouGlobalCollectionId(playlistId: string): boolean {
  return /^gcid_[a-z0-9]+$/i.test(playlistId);
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function getPlaylistCoverUrl(songs: KugouSongRaw[]): string {
  const cover = songs.find((s) => s.trans_param?.union_cover)?.trans_param
    ?.union_cover;
  return cover?.replace("{size}", "300") || "";
}

// ============================================================
// URL / 路径构建
// ============================================================

export function buildKugouPlaylistApiPath(
  playlistId: string,
  page: number,
  pageSize = KUGOU_PAGE_SIZE
): string {
  return `/api/v3/special/song?plat=0&specialid=${encodeURIComponent(playlistId)}&page=${page}&pagesize=${pageSize}&version=8352&with_res_tag=1`;
}

// ============================================================
// 签名与请求头
// ============================================================

export async function signKugouAndroidParams(
  params: Record<string, string | number>,
  body = ""
): Promise<string> {
  await ensureForge();
  const paramsString = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("");
  return _forge!.md5
    .create()
    .update(
      _forge!.util.encodeUtf8(
        `${KUGOU_ANDROID_SIGN_KEY}${paramsString}${body}${KUGOU_ANDROID_SIGN_KEY}`
      )
    )
    .digest()
    .toHex();
}

export async function buildKugouAndroidSignedUrl(
  baseUrl: string,
  params: Record<string, string | number>,
  body = ""
): Promise<string> {
  const signature = await signKugouAndroidParams(params, body);
  const searchParams = new URLSearchParams();
  Object.entries({ ...params, signature }).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });
  return `${baseUrl}?${searchParams.toString()}`;
}

export function buildKugouAndroidHeaders(
  url: string,
  dfid: string,
  mid: string
): Record<string, string> {
  const params = new URL(url).searchParams;
  return {
    "User-Agent": "Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi",
    dfid: params.get("dfid") || dfid,
    mid: params.get("mid") || mid,
    clienttime:
      params.get("clienttime") || String(Math.floor(Date.now() / 1000)),
    "kg-rc": "1",
    "kg-thash": "5d816a0",
    "kg-rec": "1",
    "kg-rf": "B9EDA08A64250DEFFBCADDEE00F8F25F",
  };
}

export async function buildKugouGlobalPlaylistSongsUrl(
  playlistId: string,
  page: number,
  dfid: string,
  mid: string,
  pageSize = KUGOU_PAGE_SIZE
): Promise<string> {
  const params: Record<string, string | number> = {
    appid: 1005,
    clientver: 20489,
    dfid,
    mid,
    uuid: "-",
    clienttime: Math.floor(Date.now() / 1000),
    area_code: 1,
    begin_idx: (page - 1) * pageSize,
    plat: 1,
    type: 1,
    mode: 1,
    personal_switch: 1,
    extend_fields: "abtags,hot_cmt,popularization",
    pagesize: pageSize,
    global_collection_id: playlistId,
  };
  return buildKugouAndroidSignedUrl(
    "https://gateway.kugou.com/pubsongs/v2/get_other_list_file_nofilt",
    params
  );
}

export async function buildKugouGlobalPlaylistInfoUrl(
  dfid: string,
  mid: string,
  body: string
): Promise<string> {
  const params: Record<string, string | number> = {
    appid: 1005,
    clientver: 20489,
    dfid,
    mid,
    uuid: "-",
    clienttime: Math.floor(Date.now() / 1000),
  };
  return buildKugouAndroidSignedUrl(
    "https://gateway.kugou.com/v3/get_list_info",
    params,
    body
  );
}

// ============================================================
// JSON / HTML 解析
// ============================================================

export function parseKugouPlaylistResponse(
  text: string
): KugouPlaylistResponse {
  const jsonText = text
    .replace(/^<!--KG_TAG_RES_START-->/, "")
    .replace(/<!--KG_TAG_RES_END-->$/, "")
    .trim();
  return JSON.parse(jsonText) as KugouPlaylistResponse;
}

export function parseKugouGlobalPlaylistSongsResponse(
  text: string
): KugouGlobalPlaylistSongsResponse {
  return JSON.parse(text) as KugouGlobalPlaylistSongsResponse;
}

export function parseKugouGlobalPlaylistInfoResponse(
  text: string
): KugouGlobalPlaylistInfoResponse {
  return JSON.parse(text) as KugouGlobalPlaylistInfoResponse;
}

export function parseKugouPlaylistTitle(html: string): string | null {
  const metaMatch = html.match(
    /<meta\s+name="keywords"\s+content="[^"]*?,([^",]+),/i
  );
  if (metaMatch?.[1]?.trim()) return decodeHtmlEntities(metaMatch[1].trim());

  const titleMatch = html.match(/<title>(.*?)_精选集_/i);
  return titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1].trim()) : null;
}

// ============================================================
// 歌曲转换
// ============================================================

function normalizeArtists(song: KugouSongRaw): string[] {
  const fromAuthors = song.authors
    ?.map((item) => item.author_name)
    .filter(Boolean) as string[] | undefined;
  if (fromAuthors?.length) return fromAuthors;

  const raw =
    song.singername ||
    song.author_name ||
    splitFilename(song.filename || "").artist;
  return raw
    .split(/[、,/&]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function splitFilename(filename: string): { artist: string; title: string } {
  const [artist, ...titleParts] = filename.split(" - ");
  return {
    artist: titleParts.length ? artist : "",
    title: titleParts.join(" - "),
  };
}

function stripArtistsFromFilename(filename: string, artists: string[]): string {
  const parsed = splitFilename(filename);
  if (parsed.title) return parsed.title;
  const prefix = artists.join("、");
  return prefix && filename.startsWith(`${prefix} - `)
    ? filename.slice(prefix.length + 3)
    : filename;
}

export function convertKugouSongToMusicTrack(song: KugouSongRaw): MusicTrack {
  const rawId =
    song.hash ||
    song.HASH ||
    song.audio_id ||
    song.album_audio_id ||
    song.songname ||
    song.filename ||
    "unknown";
  const artists = normalizeArtists(song);
  const name =
    song.songname ||
    song.audio_name ||
    stripArtistsFromFilename(song.filename || "", artists) ||
    "未知歌曲";
  const coverUrl =
    song.trans_param?.union_cover?.replace("{size}", "300") || "";

  return {
    id: `kugou_${rawId}`,
    name,
    artist: artists.length ? artists : ["未知歌手"],
    album: song.album_name || song.albumname || "",
    pic_id: coverUrl,
    url_id: String(rawId),
    lyric_id: String(rawId),
    source: "kugou",
  };
}

// ============================================================
// I/O 抽象：分页拉取
// ============================================================

export async function fetchKugouPlaylistPages(
  playlistId: string,
  fetchText: (path: string) => Promise<string>
): Promise<KugouPlaylistDetail> {
  const songs: KugouSongRaw[] = [];
  let total = 0;

  for (let page = 1; page <= 100; page += 1) {
    const response = parseKugouPlaylistResponse(
      await fetchText(buildKugouPlaylistApiPath(playlistId, page))
    );
    if (response.status !== 1 || response.errcode !== 0) {
      throw new Error(response.error || "酷狗歌单接口返回异常");
    }

    const pageSongs = response.data?.info || [];
    total = response.data?.total || total;
    songs.push(...pageSongs);

    if (!pageSongs.length || (total > 0 && songs.length >= total)) break;
  }

  if (!songs.length) throw new Error("歌单为空，无法导入");

  return {
    name: `酷狗歌单 ${playlistId}`,
    coverUrl: getPlaylistCoverUrl(songs),
    trackCount: total || songs.length,
    songs,
  };
}

export async function fetchKugouGlobalPlaylistPages(
  playlistId: string,
  dfid: string,
  mid: string,
  fetchText: (url: string) => Promise<string>,
  fetchInfo?: (url: string, body: string) => Promise<string | null>
): Promise<KugouPlaylistDetail> {
  const songs: KugouSongRaw[] = [];
  let total = 0;

  for (let page = 1; page <= 100; page += 1) {
    const url = await buildKugouGlobalPlaylistSongsUrl(
      playlistId,
      page,
      dfid,
      mid
    );
    const response = parseKugouGlobalPlaylistSongsResponse(
      await fetchText(url)
    );
    if (response.status !== 1) {
      throw new Error(
        response.error ||
          `酷狗歌单接口返回异常: ${response.error_code ?? "unknown"}`
      );
    }

    const pageSongs = response.data?.info || response.data?.list || [];
    total = response.data?.total || total;
    songs.push(...pageSongs);

    if (!pageSongs.length || (total > 0 && songs.length >= total)) break;
  }

  if (!songs.length) throw new Error("歌单为空，无法导入");

  const detail: KugouPlaylistDetail = {
    name: `酷狗歌单 ${playlistId}`,
    coverUrl: getPlaylistCoverUrl(songs),
    trackCount: total || songs.length,
    songs,
  };

  return fetchInfo
    ? withKugouGlobalPlaylistMeta(playlistId, detail, dfid, mid, fetchInfo)
    : detail;
}

// ============================================================
// I/O 抽象：元数据补充
// ============================================================

export async function withKugouPlaylistMeta(
  playlistId: string,
  detail: KugouPlaylistDetail,
  fetchPage: (url: string) => Promise<string | null>
): Promise<KugouPlaylistDetail> {
  try {
    const html = await fetchPage(
      `https://www.kugou.com/yy/special/single/${playlistId}.html`
    );
    const name = html ? parseKugouPlaylistTitle(html) : null;
    return name ? { ...detail, name } : detail;
  } catch {
    return detail;
  }
}

export async function withKugouGlobalPlaylistMeta(
  playlistId: string,
  detail: KugouPlaylistDetail,
  dfid: string,
  mid: string,
  fetchInfo: (url: string, body: string) => Promise<string | null>
): Promise<KugouPlaylistDetail> {
  try {
    const body = JSON.stringify({
      data: [{ global_collection_id: playlistId }],
      userid: 0,
      token: "",
    });
    const infoUrl = await buildKugouGlobalPlaylistInfoUrl(dfid, mid, body);
    const response = parseKugouGlobalPlaylistInfoResponse(
      (await fetchInfo(infoUrl, body)) || ""
    );
    const info = response.data?.[0];
    if (!info) return detail;

    return {
      ...detail,
      name: info.name || info.specialname || info.title || detail.name,
      coverUrl:
        info.img || info.pic || info.cover || info.cover_url || detail.coverUrl,
      trackCount: info.song_count || info.count || detail.trackCount,
    };
  } catch {
    return detail;
  }
}

// ============================================================
// 设备注册辅助（纯函数，fetch 由调用方负责）
// ============================================================

export async function buildKugouDeviceRegistrationPayload(
  mid: string
): Promise<{
  url: string;
  headers: Record<string, string>;
  body: string;
  encryptKey: string;
  iv: string;
}> {
  await ensureForge();
  const randomKey = Array.from(
    { length: 6 },
    () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]
  ).join("");
  const hash = await md5Hex(randomKey);
  const encryptKey = hash.substring(0, 16);
  const iv = hash.substring(16, 32);

  const deviceParams = {
    availableRamSize: 4983533568,
    availableRomSize: 48114719,
    availableSDSize: 48114717,
    basebandVer: "",
    batteryLevel: 100,
    batteryStatus: 3,
    brand: "Xiaomi",
    buildSerial: "unknown",
    device: "marble",
    imei: mid.substring(0, 15),
    imsi: "",
    manufacturer: "Xiaomi",
    uuid: mid,
    accelerometer: false,
    accelerometerValue: "",
    gravity: false,
    gravityValue: "",
    gyroscope: false,
    gyroscopeValue: "",
    light: false,
    lightValue: "",
    magnetic: false,
    magneticValue: "",
    orientation: false,
    orientationValue: "",
    pressure: false,
    pressureValue: "",
    step_counter: false,
    step_counterValue: "",
    temperature: false,
    temperatureValue: "",
  };

  const cipher = _forge!.cipher.createCipher("AES-CBC", encryptKey);
  cipher.start({ iv });
  cipher.update(
    _forge!.util.createBuffer(JSON.stringify(deviceParams), "utf8")
  );
  cipher.finish();
  const body = _forge!.util.encode64(cipher.output.getBytes());

  const pki = _forge!.pki.publicKeyFromPem(KUGOU_RSA_PUBLIC_KEY);
  const rsaInput = JSON.stringify({ aes: randomKey, uid: "0", token: "" });
  const rsaEncrypted = pki.encrypt(
    _forge!.util.encodeUtf8(rsaInput),
    "RSAES-PKCS1-V1_5"
  );
  const p = _forge!.util.bytesToHex(rsaEncrypted);

  const ct = Math.floor(Date.now() / 1000);
  const params: Record<string, string | number> = {
    appid: 1005,
    clientver: 20489,
    dfid: "-",
    mid,
    uuid: "-",
    clienttime: ct,
    part: 1,
    platid: 1,
    p,
  };
  const paramsStr = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("");
  const signature = await md5Hex(
    `${KUGOU_ANDROID_SIGN_KEY}${paramsStr}${body}${KUGOU_ANDROID_SIGN_KEY}`
  );

  const sp = new URLSearchParams();
  Object.entries({ ...params, signature }).forEach(([k, v]) =>
    sp.set(k, String(v))
  );

  return {
    url: `https://userservice.kugou.com/risk/v2/r_register_dev?${sp.toString()}`,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi",
      dfid: "-",
      mid,
      clienttime: String(ct),
      "kg-rc": "1",
      "kg-thash": "5d816a0",
      "kg-rec": "1",
      "kg-rf": "B9EDA08A64250DEFFBCADDEE00F8F25F",
    },
    body,
    encryptKey,
    iv,
  };
}

export async function parseKugouDeviceRegistrationResponse(
  raw: Uint8Array,
  encryptKey: string,
  iv: string
): Promise<{ dfid: string }> {
  await ensureForge();
  const decipher = _forge!.cipher.createDecipher("AES-CBC", encryptKey);
  decipher.start({ iv });
  decipher.update(
    _forge!.util.createBuffer(
      Array.from(raw)
        .map((b) => String.fromCharCode(b))
        .join(""),
      "raw"
    )
  );
  decipher.finish();
  const data = JSON.parse(decipher.output.toString());

  if (data.status !== 1 || !data.data?.dfid) {
    throw new Error("设备注册失败: 未获取到 dfid");
  }

  return { dfid: data.data.dfid };
}
