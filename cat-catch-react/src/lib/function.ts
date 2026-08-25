/**
 * 通用辅助函数 - 1:1 还原原 js/function.js
 * 所有 G.xxx 引用改为从 useSettingsStore.getState() 读取
 */
import { useSettingsStore } from '@stores/settings';
import { templates, type TemplateContext } from '@lib/template';

/** 小于 10 加 0(还原 function.js 第 6-8 行) */
export function appendZero(date: number | string): string | number {
  return parseInt(String(date), 10) < 10 ? `0${date}` : date;
}

/** 秒转 HH:MM:SS(还原 function.js 第 15-23 行) */
export function secToTime(sec: number): string {
  let hour = (sec / 3600) | 0;
  let min = ((sec % 3600) / 60) | 0;
  sec = (sec % 60) | 0;
  let time = hour > 0 ? hour + ':' : '';
  time += min.toString().padStart(2, '0') + ':';
  time += sec.toString().padStart(2, '0');
  return time;
}

/** 格式化比特率(还原 function.js 第 30-35 行) */
export function formatBitrate(bps: number): string {
  if (bps >= 1000 * 1000) {
    return (bps / 1000 / 1000).toFixed(2) + ' Mbps';
  }
  return (bps / 1000).toFixed(2) + ' kbps';
}

/** 字节转大小(还原 function.js 第 42-51 行) */
export function byteToSize(byte?: number): string | 0 {
  if (!byte || byte < 1024) return 0;
  if (byte < 1024 * 1024) {
    return (byte / 1024).toFixed(1) + 'KB';
  } else if (byte < 1024 * 1024 * 1024) {
    return (byte / 1024 / 1024).toFixed(1) + 'MB';
  } else {
    return (byte / 1024 / 1024 / 1024).toFixed(1) + 'GB';
  }
}

/** Firefox data URL 下载(还原 function.js 第 58-64 行) */
export function downloadDataURL(url: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
}

/** 判空(还原 function.js 第 71-76 行) */
export function isEmpty(obj: unknown): obj is null | undefined | '' | ' ' {
  return (
    typeof obj === 'undefined' ||
    obj === null ||
    obj === '' ||
    obj === ' '
  );
}

/** 从 url 中获取文件名(还原 function.js 第 179-183 行) */
export function getUrlFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').pop();
    return filename ? filename : 'NULL';
  } catch {
    return 'NULL';
  }
}

const reJSONparse = /([{,]\s*)([\w-]+)(\s*:)/g;

/** JSON.parse 容错(还原 function.js 第 192-207 行) */
export function JSONparse<T = Record<string, unknown>>(
  str: string | null | undefined,
  error: T = {} as T,
  attempt = 0,
): T {
  if (!str) return error;
  try {
    return JSON.parse(str) as T;
  } catch {
    if (attempt === 0) {
      reJSONparse.lastIndex = 0;
      const fixedStr = str.replace(reJSONparse, '$1"$2"$3');
      return JSONparse(fixedStr, error, ++attempt);
    }
    return error;
  }
}

/** ArrayBuffer -> Blob,大于 2G 切割(还原 function.js 第 215-241 行) */
export function ArrayBufferToBlob(
  buffer: ArrayBuffer | Uint8Array | Blob,
  options: BlobPropertyBag = {},
): Blob {
  if (buffer instanceof Blob) return buffer;
  let buf: ArrayBuffer;
  if (buffer instanceof Uint8Array) {
    buf = buffer.buffer as ArrayBuffer;
  } else {
    buf = buffer as ArrayBuffer;
  }
  if (!buf.byteLength) return new Blob();
  if (buf.byteLength >= 2 * 1024 * 1024 * 1024) {
    const MAX_CHUNK = 1024 * 1024 * 1024;
    let offset = 0;
    const blobs: Blob[] = [];
    while (offset < buf.byteLength) {
      const chunkSize = Math.min(MAX_CHUNK, buf.byteLength - offset);
      const chunk = buf.slice(offset, offset + chunkSize);
      blobs.push(new Blob([chunk]));
      offset += chunkSize;
    }
    return new Blob(blobs, options);
  }
  return new Blob([buf], options);
}

const reFilterFileName = /[<>:"|?*~]/g;

/** 过滤文件名特殊字符(不含路径,还原 function.js 第 267-292 行) */
export function filterFileName(str: string | undefined, text?: string): string {
  if (!str) return '';
  reFilterFileName.lastIndex = 0;
  str = str.replaceAll(/\u200B/g, '').replaceAll(/\u200C/g, '').replaceAll(/\u200D/g, '');
  str = str.replace(reFilterFileName, (match) => {
    if (text) return text;
    const map: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      ':': '&colon;',
      '"': '&quot;',
      '|': '&vert;',
      '?': '&quest;',
      '*': '&ast;',
      '~': '_',
    };
    return map[match] ?? match;
  });
  if (str.endsWith('.')) str = str + 'catCatch';
  if (str.startsWith('.')) str = 'catCatch' + str;
  return str;
}

/** 替换文件名特殊字符(含路径,还原 function.js 第 249-259 行) */
export function stringModify(str: string, text?: string): string {
  if (!str) return str;
  str = filterFileName(str, text);
  str = str.replace(/[\\/]/g, (match) => {
    if (text) return text;
    return match === '\\' ? '&bsol;' : '&sol;';
  });
  return str;
}

/** 扁平化嵌套对象(还原 function.js 第 300-316 行) */
export function flattenObject(
  obj: Record<string, unknown>,
  prefix = '',
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
    const value = obj[key];
    const newKey = prefix ? `${prefix}[${key}]` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

/** 通配符 -> RegExp(还原 init.js 第 439-449 行) */
export function wildcardToRegex(urlPattern: string): RegExp {
  const regexPattern = urlPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexPattern}$`, 'i');
}

/** 判断 url 是否在避免抓取列表(还原 function.js 第 441-449 行) */
export function isDamnUrl(url: string): boolean {
  const s = useSettingsStore.getState();
  for (const re of s.damnUrl) {
    re.lastIndex = 0;
    if (re.test(url)) return true;
  }
  return false;
}

/** 判断 url 是否在屏蔽网址中(还原 function.js 第 456-465 行) */
export function isLockUrl(url: string): boolean {
  const s = useSettingsStore.getState();
  for (const rule of s.blockUrl) {
    if (!rule.state) continue;
    rule.url.lastIndex = 0;
    if (rule.url.test(url)) return true;
  }
  return false;
}

/** 关闭标签页(还原 function.js 第 472-481 行) */
export function closeTab(tabId = 0): void {
  chrome.tabs.query({}, async (tabs) => {
    if (tabs.length === 1) {
      await chrome.tabs.create({ url: 'chrome://newtab' });
      tabId ? chrome.tabs.remove(tabId) : window.close();
    } else {
      tabId ? chrome.tabs.remove(tabId) : window.close();
    }
  });
}

/**
 * 打开解析器(m3u8/mpd,还原 function.js 第 488-505 行)
 * @param data 资源对象
 * @param options 选项(autoDown / 等)
 */
export function openParser(
  data: {
    url: string;
    title?: string;
    downFileName?: string;
    tabId: number;
    initiator?: string;
    requestHeaders?: Record<string, string>;
    parsing?: 'm3u8' | 'mpd';
  },
  options: { autoDown?: boolean; [k: string]: unknown } = {},
): void {
  const G = useSettingsStore.getState();
  chrome.tabs.get(G.tabId, (tab) => {
    const params = new URLSearchParams({
      url: data.url,
      title: data.title ?? '',
      filename: data.downFileName ?? '',
      tabid: String(data.tabId === -1 ? G.tabId : data.tabId),
      initiator: data.initiator ?? '',
      requestHeaders: data.requestHeaders ? JSON.stringify(data.requestHeaders) : '',
    });
    for (const [k, v] of Object.entries(options)) {
      params.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    }
    const parser = data.parsing ?? 'm3u8';
    const url = `/${parser}.html?${params.toString()}`;
    chrome.tabs.create({
      url,
      index: tab.index + 1,
      active: G.isMobile || !options.autoDown,
    });
  });
}

/**
 * 批量发送对象数组到本地(还原 function.js 第 426-439 行)
 */
export async function send2localArray(
  action: string,
  arrayData: unknown[] | Record<string, unknown>,
  tabId = 0,
): Promise<Response> {
  if (!Array.isArray(arrayData)) {
    arrayData = [arrayData];
  }
  const G = useSettingsStore.getState();
  const results = (arrayData as Record<string, unknown>[]).map(
    (item, index) => templates('${data}', { ...(item as object), action, index, tabId } as TemplateContext),
  );
  const body = G.options.send2localBody.replaceAll('${data}', `[${results.join(',')}]`);
  const postData = JSONparse(body, { action, tabId });
  return executeCoreRequest(postData, { action, tabId });
}

/**
 * 发送单条数据到本地(还原 function.js 第 406-418 行)
 */
export async function send2local(
  action: string,
  data: Record<string, unknown> | string,
  tabId = 0,
): Promise<Response> {
  const G = useSettingsStore.getState();
  let body = G.options.send2localBody;
  let postData: Record<string, unknown>;

  if (action === 'addKey' || typeof data === 'string') {
    body = body.replaceAll('${data}', `"${data}"`);
    postData = { action, tabId };
  } else {
    (data as Record<string, unknown>).action = action;
    postData = data as Record<string, unknown>;
  }

  // templates 渲染
  const rendered = templates(body, { ...postData, tabId } as TemplateContext);
  return executeCoreRequest(JSONparse(rendered, postData), postData as TemplateContext);
}

/** 核心发送请求(还原 function.js 第 323-398 行) */
async function executeCoreRequest(
  postData: Record<string, unknown>,
  templateContext: TemplateContext,
): Promise<Response> {
  const G = useSettingsStore.getState();
  const option: RequestInit = { method: G.options.send2localMethod };

  try {
    let send2localURL = templates(G.options.send2localURL, templateContext);
    const parsedUrl = new URL(send2localURL);

    if (option.method === 'GET') {
      const flattened = flattenObject(postData);
      const urlParams = new URLSearchParams();
      for (const [k, v] of Object.entries(flattened)) {
        urlParams.set(k, String(v));
      }
      parsedUrl.search = parsedUrl.search
        ? `${parsedUrl.search}&${urlParams.toString()}`
        : `?${urlParams.toString()}`;
    } else {
      const contentTypeMap: Record<number, string> = {
        0: 'application/json;charset=utf-8',
        1: 'multipart/form-data',
        2: 'application/x-www-form-urlencoded',
        3: 'text/plain',
      };
      const contentType = contentTypeMap[G.options.send2localType] ?? 'application/json;charset=utf-8';
      option.headers = { 'Content-Type': contentType };

      switch (contentType) {
        case 'application/json;charset=utf-8':
          option.body = JSON.stringify(postData);
          break;
        case 'multipart/form-data': {
          const formData = new FormData();
          const flattened = flattenObject(postData);
          for (const [k, v] of Object.entries(flattened)) {
            formData.append(k, String(v));
          }
          option.body = formData;
          delete (option.headers as Record<string, string>)['Content-Type'];
          break;
        }
        case 'application/x-www-form-urlencoded': {
          const flattened = flattenObject(postData);
          const urlParams = new URLSearchParams();
          for (const [k, v] of Object.entries(flattened)) {
            urlParams.set(k, String(v));
          }
          option.body = urlParams.toString();
          break;
        }
        case 'text/plain':
          option.body = JSON.stringify(postData);
          break;
      }
    }

    if (G.options.send2localHeaders) {
      const customHeaders = JSONparse<Record<string, unknown>>(G.options.send2localHeaders, {});
      if (typeof customHeaders === 'string') return await fetch(parsedUrl.toString(), option);
      if (!option.headers) option.headers = {};
      for (const key in customHeaders) {
        (option.headers as Record<string, string>)[key] = String(customHeaders[key]);
      }
    }

    return await fetch(parsedUrl.toString(), option);
  } catch (e) {
    throw e;
  }
}

/** 获取远程文件大小(还原 function.js 第 543-570 行) */
export async function getRemoteFileSize(url: string): Promise<number> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const size = parseInt(res.headers.get('content-length') ?? '', 10);
    if (size && !Number.isNaN(size)) return size;
    throw new Error('HEAD no content-length');
  } catch {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
    });
    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const match = /\/(\d+)$/.exec(contentRange);
      if (match) {
        const size = parseInt(match[1] ?? '', 10);
        if (size && !Number.isNaN(size)) return size;
      }
    }
    const size = parseInt(res.headers.get('content-length') ?? '', 10);
    if (size && !Number.isNaN(size)) return size;
    throw new Error('GET range no size');
  }
}

/** 获取当前 tab id(原项目 implicit) */
export async function getCurrentTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id ?? -1;
}

/** 是否为移动端 UA(还原 G.isMobile) */
export const isMobile: boolean =
  typeof navigator !== 'undefined' &&
  /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
