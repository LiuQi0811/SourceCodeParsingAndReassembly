/**
 * M3U8 解密与合并
 * 1:1 还原原 m3u8-decrypt.js (AESDecryptor) + m3u8.js 的解密/合并 pipeline
 *
 * 关键还原点:
 * - AES-128-CBC 解密:用 WebCrypto crypto.subtle 替代纯 JS AESDecryptor
 *   (行为等价 removePKCS7Padding=true,WebCrypto decrypt 自动去 PKCS7 padding)
 * - IV 生成:fragment.decryptdata.iv 存在则用之,否则 16 字节默认 IV
 *   [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,fragment.sn] (还原 m3u8.js L1573)
 * - key 获取:fetch(decryptdata.uri) -> arrayBuffer,16 字节才有效
 *   (还原 m3u8.js L693-712,按 uri 存 keyContent Map,占位 true 防重复下载)
 * - initSegment (#EXT-X-MAP):fetch -> arrayBuffer,按 url 存 initData Map,
 *   解密后前置到 fragment buffer(还原 m3u8.js L1583-1587)
 * - pipeline 步骤:作为 Downloader.use 注入,名 'decrypt'
 */
import type { Fragment } from './m3u8-downloader';

/** hex 字符串 -> Uint8Array */
export function hexToUint8Array(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

/** base64 -> Uint8Array */
export function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 默认 IV:16 字节,前 15 字节为 0,末字节为 sn(还原 m3u8.js L1573) */
export function buildDefaultIv(sn: number): Uint8Array {
  const iv = new Uint8Array(16);
  iv[15] = sn & 0xff;
  // sn 超过 1 字节时,大端序写入末尾(兼容大序号)
  const view = new DataView(iv.buffer);
  view.setUint32(12, sn >>> 0);
  return iv;
}

/** 解析 key 字符串(hex/base64/已是 Uint8Array)为 Uint8Array */
export function parseKey(raw: string | Uint8Array): Uint8Array {
  if (raw instanceof Uint8Array) return raw;
  const str = raw.trim();
  if (/^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0 && str.length === 32) {
    return hexToUint8Array(str);
  }
  return base64ToUint8Array(str);
}

/** fetch 获取 key(16 字节才有效),还原 m3u8.js L697-711 */
export async function fetchKey(uri: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(uri);
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength === 16) return buffer;
    return null;
  } catch {
    return null;
  }
}

/** fetch 获取 initSegment,byteRange 时加 Range 头,还原 m3u8.js L720-732 */
export async function fetchInitSegment(
  url: string,
  byteRange?: [number, number],
): Promise<ArrayBuffer> {
  const options: RequestInit = {};
  if (byteRange && byteRange.length === 2) {
    options.headers = { Range: `bytes=${byteRange[0]}-${byteRange[1] - 1}` };
  }
  const res = await fetch(url, options);
  return await res.arrayBuffer();
}

/** AES-128-CBC 解密(WebCrypto 替代 AESDecryptor.decrypt) */
export async function decryptAes128(
  data: ArrayBuffer,
  key: ArrayBuffer | Uint8Array,
  iv: ArrayBuffer | Uint8Array,
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as unknown as BufferSource,
    { name: 'AES-CBC' },
    false,
    ['decrypt'],
  );
  // WebCrypto decrypt 自动去 PKCS7 padding,等价 removePKCS7Padding=true
  return await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv: iv as unknown as BufferSource },
    cryptoKey,
    data,
  );
}

/** 把 initSegment 数据前置到 fragment buffer(还原 m3u8.js addInitSegmentData) */
export function addInitSegmentData(
  buffer: ArrayBuffer,
  initSegment: { url: string },
  initData: Map<string, ArrayBuffer | true>,
): ArrayBuffer {
  const initBuffer = initData.get(initSegment.url);
  if (!(initBuffer instanceof ArrayBuffer)) return buffer;
  const combined = new Uint8Array(initBuffer.byteLength + buffer.byteLength);
  combined.set(new Uint8Array(initBuffer), 0);
  combined.set(new Uint8Array(buffer), initBuffer.byteLength);
  return combined.buffer;
}

export interface DecryptPipelineOptions {
  skipDecrypt: boolean;
  /** 录制模式跳过解密 */
  recorder: boolean;
  /** uri -> key(16 字节 ArrayBuffer) 或占位 true */
  keyContent: Map<string, ArrayBuffer | true>;
  /** url -> initSegment buffer 或占位 true */
  initData: Map<string, ArrayBuffer | true>;
}

/**
 * 创建解密 pipeline 步骤(还原 m3u8.js L1556-1590 'decrypt')
 * 作为 Downloader.use 注入
 */
export function createDecryptPipeline(opts: DecryptPipelineOptions) {
  return async function decryptStep(
    buffer: ArrayBuffer,
    fragment: Fragment,
  ): Promise<ArrayBuffer> {
    // 跳过解密:skipDecrypt / 录制 / 未加密
    if (opts.skipDecrypt || opts.recorder || !fragment.encrypted || !fragment.decryptdata) {
      if (fragment.initSegment && !(fragment as { live?: boolean }).live) {
        return addInitSegmentData(buffer, fragment.initSegment, opts.initData);
      }
      if (fragment.initSegment && (fragment as { live?: boolean }).live && fragment.index === 0) {
        return addInitSegmentData(buffer, fragment.initSegment, opts.initData);
      }
      return buffer;
    }

    const key = opts.keyContent.get(fragment.decryptdata.uri ?? '');
    if (!(key instanceof ArrayBuffer)) {
      throw new Error('key not ready: ' + (fragment.decryptdata.uri ?? ''));
    }

    const iv =
      fragment.decryptdata.iv ??
      buildDefaultIv((fragment as { sn?: number }).sn ?? fragment.index);

    try {
      const decrypted = await decryptAes128(buffer, key, iv);
      if (fragment.initSegment) {
        return addInitSegmentData(decrypted, fragment.initSegment, opts.initData);
      }
      return decrypted;
    } catch (e) {
      throw e;
    }
  };
}

/** 预处理 pipeline 步骤:切除 JPEG 图片头部(还原 m3u8.js L1518-1553 'preprocess') */
export function preprocessStep(buffer: ArrayBuffer): ArrayBuffer {
  const view = new Uint8Array(buffer);
  const len = view.length;
  if (len < 4 || view[0] !== 0xff || view[1] !== 0xd8) return buffer;
  let tsStartIndex = -1;
  for (let i = 0; i < len - 2; i++) {
    if (view[i] === 0xff && view[i + 1] === 0xd9) {
      tsStartIndex = i + 2;
      break;
    }
  }
  if (tsStartIndex === -1 || tsStartIndex >= len) return buffer;
  return buffer.slice(tsStartIndex);
}

/** 顺序合并多个 ArrayBuffer 为 Blob(用于非流式下载落盘) */
export function mergeBuffers(buffers: (ArrayBuffer | undefined)[]): Blob {
  const parts: BlobPart[] = [];
  for (const buf of buffers) {
    if (buf instanceof ArrayBuffer) parts.push(new Uint8Array(buf));
  }
  return new Blob(parts, { type: 'video/mp2t' });
}

/** 流式写入封装:把 Downloader 的 sequentialPush 事件转为文件流写入 */
export interface FileStream {
  write: (chunk: Uint8Array) => void;
  close: () => void;
  abort?: () => void;
}

/** 基于 Blob 的内存流(回退方案,不依赖 StreamSaver) */
export function createMemoryFileStream(): FileStream & { getBlob: () => Blob } {
  const parts: BlobPart[] = [];
  return {
    write: (chunk: Uint8Array) => parts.push(chunk.slice()),
    close: () => undefined,
    getBlob: () => new Blob(parts, { type: 'video/mp2t' }),
  };
}
