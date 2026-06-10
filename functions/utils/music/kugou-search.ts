interface KugouSearchSongRaw {
  FileHash?: string;
  SongName?: string;
  AlbumName?: string;
  AlbumID?: string | number;
  SingerId?: string | number;
  SingerName?: string;
}

interface KugouSearchResponse {
  status?: number;
  data?: {
    lists?: KugouSearchSongRaw[];
    total?: number;
  };
}

interface MusicTrackResult {
  id: string;
  name: string;
  artist: string[];
  album: string;
  pic_id: string;
  url_id: string;
  lyric_id: string;
  source: string;
  album_id: string | undefined;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function convertKugouSearchSong(song: KugouSearchSongRaw): MusicTrackResult {
  const rawId = song.FileHash || "";
  return {
    id: `kugou_${rawId}`,
    name: song.SongName || "未知歌曲",
    artist: splitArtists(song.SingerName),
    album: song.AlbumName || "",
    pic_id: "",
    url_id: rawId,
    lyric_id: rawId,
    source: "kugou",
    album_id: song.AlbumID ? String(song.AlbumID) : undefined,
  };
}

function splitArtists(raw?: string): string[] {
  return (raw || "未知歌手")
    .split(/[、,/&]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export async function searchKugouMusic(
  query: string,
  page: number,
  limit: number
): Promise<{ items: MusicTrackResult[]; total: number }> {
  const targetPage = Math.max(1, page + 1);
  const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(query)}&page=${targetPage}&pagesize=${limit}`;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return { items: [], total: 0 };

  const data = (await res.json()) as KugouSearchResponse;
  const lists = data.data?.lists || [];
  const items = lists.map(convertKugouSearchSong);

  return { items, total: data.data?.total || 0 };
}

export async function getKugouLyric(hash: string): Promise<string | null> {
  const timestamp = Date.now();
  const url = `https://wwwapi.kugou.com/yy/index.php?r=play/getdata&callback=jQuery&mid=1&hash=${hash}&platid=4&_=${timestamp}`;

  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;

  const text = await res.text();
  const jsonStr = text.replace(/^jQuery\d*_?\d*\(/, "").replace(/\);?\s*$/, "");
  try {
    const data = JSON.parse(jsonStr) as { data?: { lyrics?: string } };
    return data.data?.lyrics || null;
  } catch {
    return null;
  }
}
