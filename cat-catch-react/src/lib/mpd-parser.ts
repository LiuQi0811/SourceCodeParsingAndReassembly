/**
 * MPD(DASH) 解析器
 * 1:1 还原原 js/mpd.js 中对 lib/mpd-parser.min.js 的调用
 *
 * 复用 src/public/lib/mpd-parser.min.js(原 lib/mpd-parser.min.js)
 * 通过 <script src="/lib/mpd-parser.min.js"> 在 mpd/index.html 注入
 * 全局暴露 window.mpdParser.parse(text, { manifestUri })
 *
 * 输出结构(video.js mpd-parser):
 *   {
 *     duration,              // 总时长(秒)
 *     playlists: [           // 视频码率列表
 *       {
 *         attributes: { NAME, BANDWIDTH, RESOLUTION{width,height}, 'FRAME-RATE', CODECS, ... },
 *         targetDuration, segments: [{ resolvedUri, duration, map: { resolvedUri, ... } }],
 *         sidx?, ...
 *       }
 *     ],
 *     mediaGroups: { AUDIO: { audio: { [lang]: { playlists: [...] } } }, SUBTITLES, ... },
 *     ...
 *   }
 *
 * DRM 检测单独用 DOMParser 解析 <ContentProtection>(还原 isDRM)
 */

/** window 上挂载的 mpdParser 全局 */
declare global {
  interface Window {
    mpdParser?: {
      parse: (
        mpdContent: string,
        options?: { manifestUri?: string },
      ) => MpdParsedManifest;
    };
  }
}

export interface MpdSegment {
  resolvedUri: string;
  duration?: number;
  map?: { resolvedUri: string; byterange?: { length: number; offset: number } };
  number?: number;
  timeline?: number;
  presentationTime?: number;
}

export interface MpdPlaylist {
  attributes: {
    NAME?: string;
    BANDWIDTH?: number;
    RESOLUTION?: { width: number; height: number };
    'FRAME-RATE'?: number;
    CODECS?: string;
    [key: string]: unknown;
  };
  targetDuration?: number;
  segments: MpdSegment[];
  resolvedUri?: string;
  uri?: string;
  endList?: boolean;
  sidx?: unknown;
  contentProtection?: unknown;
}

export interface MpdMediaGroup {
  language?: string;
  default?: boolean;
  autoselect?: boolean;
  playlists: MpdPlaylist[];
  uri?: string;
}

export interface MpdParsedManifest {
  duration: number;
  playlists: MpdPlaylist[];
  mediaGroups?: {
    AUDIO?: { audio?: Record<string, MpdMediaGroup> };
    SUBTITLES?: { subs?: Record<string, MpdMediaGroup> };
    'CLOSED-CAPTIONS'?: Record<string, unknown>;
    VIDEO?: Record<string, MpdMediaGroup>;
  };
  locations?: string[];
  timelineStarts?: Array<{ start: number; timeline: number }>;
}

export interface MpdDrmInfo {
  schemeIdUri: string;
  pssh: string;
  encryptionType: 'Widevine' | 'Microsoft PlayReady' | 'Apple FairPlay' | 'Unknown';
}

/** 从 schemeIdUri 判定加密类型(还原 mpd.js getEncryptionType) */
function getEncryptionType(schemeIdUri: string): MpdDrmInfo['encryptionType'] {
  if (schemeIdUri.includes('edef8ba9-79d6-4ace-a3c8-27dcd51d21ed')) return 'Widevine';
  if (schemeIdUri.includes('9a04f079-9840-4286-ab92-e65be0885f95'))
    return 'Microsoft PlayReady';
  if (schemeIdUri.includes('94ce86fb-07ff-4f43-adb8-93d2fa968ca2'))
    return 'Apple FairPlay';
  return 'Unknown';
}

/** 解析 <ContentProtection> DRM 信息(还原 mpd.js isDRM) */
export function isDRM(mpdContent: string): MpdDrmInfo[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(mpdContent, 'application/xml');
  const drmInfo = new Map<string, string>();
  const contentProtections = xmlDoc.getElementsByTagName('ContentProtection');
  for (let i = 0; i < contentProtections.length; i++) {
    const protection = contentProtections.item(i);
    if (!protection) continue;
    const schemeIdUri = protection.getAttribute('schemeIdUri') ?? '';
    let psshEl = protection.getElementsByTagName('cenc:pssh').item(0);
    if (!psshEl) psshEl = protection.getElementsByTagName('mspr:pro').item(0);
    const pssh = psshEl?.textContent ?? '';
    if (schemeIdUri && pssh && !drmInfo.has(schemeIdUri)) {
      drmInfo.set(schemeIdUri, pssh);
    }
  }
  return Array.from(drmInfo.entries()).map(([schemeIdUri, pssh]) => ({
    schemeIdUri,
    pssh,
    encryptionType: getEncryptionType(schemeIdUri),
  }));
}

/**
 * 解析 MPD 文本 -> MpdParsedManifest
 * 等价 mpd.js 中:mpdParser.parse(mpdContent, { manifestUri: _url })
 */
export function parseMPD(mpdContent: string, manifestUri?: string): MpdParsedManifest {
  if (!window.mpdParser) {
    throw new Error('mpd-parser.min.js 未加载(请检查 /lib/mpd-parser.min.js)');
  }
  return window.mpdParser.parse(mpdContent, { manifestUri: manifestUri ?? '' });
}

/** 抓取 MPD 文本 */
export async function fetchMPD(
  url: string,
  headers?: Record<string, string>,
): Promise<string> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: headers ?? {},
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

/** 把 mpd playlist 转换为 m3u8 文本(还原 mpd.js videoToM3u8/audioToM3u8) */
export function playlistToM3u8(playlist: MpdPlaylist): string {
  if (!playlist.segments.length) return '';
  const targetDuration = playlist.targetDuration ?? Math.ceil(
    Math.max(...playlist.segments.map((s) => s.duration ?? 0)),
  );
  const init = playlist.segments[0]?.map;
  let m3u8 = '#EXTM3U\n';
  m3u8 += '#EXT-X-VERSION:3\n';
  m3u8 += `#EXT-X-TARGETDURATION:${targetDuration}\n`;
  m3u8 += '#EXT-X-MEDIA-SEQUENCE:0\n';
  m3u8 += '#EXT-X-PLAYLIST-TYPE:VOD\n';
  if (init?.resolvedUri) {
    m3u8 += `#EXT-X-MAP:URI="${init.resolvedUri}"\n`;
  }
  for (const seg of playlist.segments) {
    m3u8 += `#EXTINF:${seg.duration ?? 0},\n`;
    m3u8 += `${seg.resolvedUri}\n`;
  }
  m3u8 += '#EXT-X-ENDLIST';
  return m3u8;
}

/** 格式化视频码率项展示文本(还原 mpd.js #mpdVideoLists option) */
export function formatVideoOption(pl: MpdPlaylist, index: number): string {
  const a = pl.attributes;
  const name = a.NAME ?? String(index);
  const bandwidth = a.BANDWIDTH ? (a.BANDWIDTH / 1024).toFixed(1) : '?';
  const fps = a['FRAME-RATE'] ? (a['FRAME-RATE'] as number).toFixed(1) : '?';
  const resolution = a.RESOLUTION
    ? `${a.RESOLUTION.width}x${a.RESOLUTION.height}`
    : '?';
  return `${name} | ${bandwidth} kbps | ${fps} fps | ${resolution}`;
}

/** 格式化音频码率项展示文本(还原 mpd.js #mpdAudioLists option) */
export function formatAudioOption(group: string, pl: MpdPlaylist): string {
  const bandwidth = pl.attributes.BANDWIDTH
    ? (pl.attributes.BANDWIDTH / 1000).toFixed(0)
    : '?';
  const name = pl.attributes.NAME ?? group;
  return `${group} | ${name} | ${bandwidth}Kbps`;
}
