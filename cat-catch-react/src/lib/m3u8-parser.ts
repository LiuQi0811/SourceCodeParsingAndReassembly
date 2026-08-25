/**
 * M3U8 解析器(手写)
 * 1:1 还原原 hls.js 解析能力 + m3u8.js 的 _fragments 字段提取
 *
 * 决定手写而非依赖 hls.js 运行时,因为:
 *  - m3u8 格式简单,手写可精确控制字段,1:1 对齐 Downloader.Fragment
 *  - 不受 hls.js 版本 API 变化影响
 *  - 不需要 MediaSource(hls.js 运行时依赖,扩展页面可能受限)
 *
 * 支持标签:
 *   master: #EXT-X-STREAM-INF / #EXT-X-MEDIA
 *   media:  #EXTINF / #EXT-X-KEY / #EXT-X-MAP / #EXT-X-BYTERANGE /
 *           #EXT-X-MEDIA-SEQUENCE / #EXT-X-DISCONTINUITY / #EXT-X-TARGETDURATION /
 *           #EXT-X-VERSION / #EXT-X-ENDLIST / #EXT-X-PLAYLIST-TYPE
 */
import { hexToUint8Array } from './m3u8-merge';
import type { Fragment } from './m3u8-downloader';

export interface M3u8Key {
  method: string; // 'AES-128' | 'NONE' | 'SAMPLE-AES-CTR' | ...
  uri?: string;
  iv?: Uint8Array;
  keyFormat?: string;
}

export interface M3u8InitSegment {
  url: string;
  byteRange?: [number, number];
}

export interface M3u8Level {
  url: string;
  bandwidth: number;
  resolution?: string;
  codecs?: string;
  attrs: Record<string, string>;
  /** #EXT-X-MEDIA 来源(audio/subtitle) */
  type?: 'AUDIO' | 'SUBTITLE';
  groupId?: string;
  name?: string;
  lang?: string;
  default?: boolean;
  autoselect?: boolean;
}

export interface M3u8ParseResult {
  isMaster: boolean;
  levels: M3u8Level[];
  audioTracks: M3u8Level[];
  subtitleTracks: M3u8Level[];
  fragments: Fragment[];
  totalDuration: number;
  live: boolean;
  version: number;
  rawM3u8: string;
  keyInfo?: M3u8Key;
  hasSampleAes?: boolean;
  targetDuration?: number;
}

/** 解析 EXT 属性字符串 -> {KEY: value},处理引号内逗号 */
function parseAttributes(attrStr: string): Record<string, string> {
  const result: Record<string, string> = {};
  const regex = /([A-Z0-9-]+)=(?:"([^"]*)"|([^,]*))/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(attrStr)) !== null) {
    const key = m[1];
    if (key) result[key] = m[2] ?? m[3] ?? '';
  }
  return result;
}

/** 解析 IV(0x 开头 hex)为 16 字节 Uint8Array */
function parseIv(ivStr: string): Uint8Array | undefined {
  if (!ivStr) return undefined;
  const hex = ivStr.startsWith('0x') || ivStr.startsWith('0X') ? ivStr.slice(2) : ivStr;
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length !== 32) return undefined;
  return hexToUint8Array(hex);
}

/** 解析 #EXT-X-BYTERANGE:length@offset,offset 可省略(用 prevEnd) */
function parseByteRange(
  str: string,
  prevEnd: number,
): [number, number] | undefined {
  const parts = str.split('@');
  const len = parseInt(parts[0] ?? '', 10);
  if (Number.isNaN(len)) return undefined;
  const offset = parts[1] !== undefined ? parseInt(parts[1], 10) : prevEnd;
  return [offset, offset + len];
}

/** 相对 URL 解析,失败返回原 line */
function resolveUrl(line: string, baseUrl?: string): string {
  if (!baseUrl) {
    try {
      return new URL(line).href;
    } catch {
      return line;
    }
  }
  try {
    return new URL(line, baseUrl).href;
  } catch {
    return line;
  }
}

/**
 * 解析 m3u8 文本
 * @param text m3u8 原始文本
 * @param baseUrl 基础 URL(用于解析相对路径,通常是 m3u8 自身 URL)
 */
export function parseM3u8(text: string, baseUrl?: string): M3u8ParseResult {
  const lines = text.split(/\r?\n/);
  const result: M3u8ParseResult = {
    isMaster: false,
    levels: [],
    audioTracks: [],
    subtitleTracks: [],
    fragments: [],
    totalDuration: 0,
    live: true,
    version: 1,
    rawM3u8: text,
  };

  if (!lines.length || !lines[0]?.startsWith('#EXTM3U')) {
    return result;
  }

  // master playlist 检测
  const hasStreamInf = lines.some((l) => l.trim().startsWith('#EXT-X-STREAM-INF'));
  result.isMaster = hasStreamInf;

  if (hasStreamInf) {
    parseMaster(lines, baseUrl, result);
  } else {
    parseMedia(lines, baseUrl, result);
  }

  return result;
}

/** 解析 master playlist(#EXT-X-STREAM-INF + #EXT-X-MEDIA) */
function parseMaster(
  lines: string[],
  baseUrl: string | undefined,
  result: M3u8ParseResult,
): void {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (!line || line.startsWith('#EXTM3U')) continue;

    if (line.startsWith('#EXT-X-STREAM-INF:')) {
      const attrs = parseAttributes(line.slice('#EXT-X-STREAM-INF:'.length));
      // 下一行是 url
      const urlLine = lines[i + 1]?.trim() ?? '';
      if (urlLine && !urlLine.startsWith('#')) {
        result.levels.push({
          url: resolveUrl(urlLine, baseUrl),
          bandwidth: parseInt(attrs.BANDWIDTH ?? '0', 10) || 0,
          resolution: attrs.RESOLUTION,
          codecs: attrs.CODECS,
          attrs,
        });
        i++;
      }
      continue;
    }

    if (line.startsWith('#EXT-X-MEDIA:')) {
      const attrs = parseAttributes(line.slice('#EXT-X-MEDIA:'.length));
      const track: M3u8Level = {
        url: attrs.URI ? resolveUrl(attrs.URI, baseUrl) : '',
        bandwidth: 0,
        attrs,
        type: attrs.TYPE as 'AUDIO' | 'SUBTITLE' | undefined,
        groupId: attrs['GROUP-ID'],
        name: attrs.NAME,
        lang: attrs.LANGUAGE,
        default: attrs.DEFAULT === 'YES',
        autoselect: attrs.AUTOSELECT === 'YES',
      };
      if (track.type === 'AUDIO') result.audioTracks.push(track);
      else if (track.type === 'SUBTITLE') result.subtitleTracks.push(track);
      continue;
    }
  }
}

/** 解析 media playlist(#EXTINF 切片 + #EXT-X-KEY + #EXT-X-MAP) */
function parseMedia(
  lines: string[],
  baseUrl: string | undefined,
  result: M3u8ParseResult,
): void {
  let sn = 0; // 当前序号(#EXT-X-MEDIA-SEQUENCE 起始,每 fragment 递增)
  let cc = 0; // 不连续计数(#EXT-X-DISCONTINUITY 递增)
  let currentKey: M3u8Key | undefined;
  let currentInit: M3u8InitSegment | undefined;
  let prevByteRangeEnd = 0;
  let currentDuration = 0; // 当前 #EXTINF 的 duration
  let pendingByteRange: [number, number] | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    if (!line) continue;

    if (line.startsWith('#EXT-X-VERSION:')) {
      result.version = parseInt(line.slice('#EXT-X-VERSION:'.length), 10) || 1;
      continue;
    }
    if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      result.targetDuration = parseInt(line.slice('#EXT-X-TARGETDURATION:'.length), 10);
      continue;
    }
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
      sn = parseInt(line.slice('#EXT-X-MEDIA-SEQUENCE:'.length), 10) || 0;
      continue;
    }
    if (line === '#EXT-X-ENDLIST') {
      result.live = false;
      continue;
    }
    if (line.startsWith('#EXT-X-PLAYLIST-TYPE:')) {
      const type = line.slice('#EXT-X-PLAYLIST-TYPE:'.length).trim().toUpperCase();
      if (type === 'VOD') result.live = false;
      continue;
    }
    if (line === '#EXT-X-DISCONTINUITY') {
      cc++;
      prevByteRangeEnd = 0;
      continue;
    }

    // #EXT-X-KEY:METHOD=,URI=,IV=,KEYFORMAT=
    if (line.startsWith('#EXT-X-KEY:')) {
      const attrs = parseAttributes(line.slice('#EXT-X-KEY:'.length));
      if (attrs.METHOD && attrs.METHOD !== 'NONE') {
        currentKey = {
          method: attrs.METHOD,
          uri: attrs.URI ? resolveUrl(attrs.URI, baseUrl) : undefined,
          iv: parseIv(attrs.IV ?? ''),
          keyFormat: attrs.KEYFORMAT,
        };
        result.keyInfo = currentKey;
        if (line.includes('METHOD=SAMPLE-AES-CTR')) {
          result.hasSampleAes = true;
        }
      } else {
        currentKey = undefined;
      }
      continue;
    }

    // #EXT-X-MAP:URI=,BYTERANGE=
    if (line.startsWith('#EXT-X-MAP:')) {
      const attrs = parseAttributes(line.slice('#EXT-X-MAP:'.length));
      const mapUrl = attrs.URI ? resolveUrl(attrs.URI, baseUrl) : '';
      const byteRange = attrs.BYTERANGE ? parseByteRange(attrs.BYTERANGE, 0) : undefined;
      currentInit = { url: mapUrl, byteRange };
      if (byteRange) prevByteRangeEnd = byteRange[1];
      continue;
    }

    // #EXT-X-BYTERANGE:length@offset
    if (line.startsWith('#EXT-X-BYTERANGE:')) {
      // 作用于下一个 fragment
      const br = parseByteRange(line.slice('#EXT-X-BYTERANGE:'.length).trim(), prevByteRangeEnd);
      // 暂存,应用到下一个 fragment
      if (br) {
        pendingByteRange = br;
        prevByteRangeEnd = br[1];
      }
      continue;
    }

    // #EXTINF:duration, title
    if (line.startsWith('#EXTINF:')) {
      const rest = line.slice('#EXTINF:'.length);
      const commaIdx = rest.indexOf(',');
      currentDuration = commaIdx >= 0
        ? parseFloat(rest.slice(0, commaIdx))
        : parseFloat(rest);
      if (Number.isNaN(currentDuration)) currentDuration = 0;
      continue;
    }

    // 切片 URL 行(非 # 开头)
    if (!line.startsWith('#')) {
      const url = resolveUrl(line, baseUrl);
      const encrypted = !!currentKey && currentKey.method !== 'NONE';
      const frag: Fragment = {
        url,
        index: result.fragments.length,
        duration: currentDuration,
        sn,
        cc,
        encrypted,
        live: result.live,
      };
      if (currentKey) {
        frag.decryptdata = {
          method: currentKey.method,
          uri: currentKey.uri,
          iv: currentKey.iv,
          keyFormat: currentKey.keyFormat,
        };
      }
      if (currentInit) {
        frag.initSegment = { ...currentInit };
      }
      if (pendingByteRange) {
        frag.byteRange = pendingByteRange;
        pendingByteRange = undefined;
      }
      result.fragments.push(frag);
      result.totalDuration += currentDuration;
      sn++;
      currentDuration = 0;
    }
  }
}

/**
 * fetch 并解析 m3u8 URL
 * 如果是 master playlist,自动选择最大带宽的子 m3u8 解析
 * @param headers 请求头(referer/cookie 等)
 */
export async function fetchAndParseM3u8(
  url: string,
  headers?: Record<string, string>,
): Promise<M3u8ParseResult> {
  const options: RequestInit = {};
  if (headers && Object.keys(headers).length > 0) {
    options.headers = headers;
  }
  const res = await fetch(url, options);
  const text = await res.text();
  const result = parseM3u8(text, url);

  // master playlist: 选最大带宽子 m3u8 再解析
  if (result.isMaster && result.levels.length > 0) {
    const best = result.levels.reduce((max, lvl) =>
      lvl.bandwidth > max.bandwidth ? lvl : max,
    );
    const sub = await fetchAndParseM3u8(best.url, headers);
    // 合并:保留 master 的 audioTracks/subtitleTracks
    return {
      ...sub,
      levels: result.levels,
      audioTracks: result.audioTracks,
      subtitleTracks: result.subtitleTracks,
    };
  }

  return result;
}
