/**
 * 配置类型定义与默认值
 * 1:1 还原原 js/init.js 的 G.OptionLists / G.LocalVar / G.scriptList / G.ffmpegConfig
 */

// ===== 操作符 =====
export type Operator = '=' | '<' | '>' | '<=' | '>=' | '!=' | '~';

export interface ExtRule {
  ext: string;
  size: number;
  operator: Operator;
  unit: 'B' | 'BYTE' | 'KB' | 'MB' | 'GB';
  state: boolean;
  /** operator === '~' 时拆出的 min/max(运行时计算,不入 storage) */
  min?: number;
  max?: number;
}

export interface TypeRule extends Omit<ExtRule, 'ext'> {
  type: string;
}

export interface RegexRule {
  type: 'i' | 'ig' | 'g' | 'gi';
  regex: string;
  ext: string;
  blackList?: boolean;
  state: boolean;
}

/** 预编译后的 Regex 项(运行时形态) */
export interface CompiledRegexRule {
  regex: RegExp;
  ext: string;
  blackList: boolean;
  state: boolean;
}

/** 通配符屏蔽 URL 规则(storage 形态) */
export interface BlockUrlRuleRaw {
  url: string;
  state: boolean;
}

/** 预编译后的通配符规则 */
export interface CompiledBlockUrlRule {
  url: RegExp;
  state: boolean;
}

// ===== 默认扩展名规则(原 init.js 第 29-62 行) =====
export const DEFAULT_EXT_RULES: ExtRule[] = [
  'flv', 'hlv', 'f4v', 'mp4', 'mp3', 'wma', 'wav', 'm4a',
  'ts', 'webm', 'ogg', 'ogv', 'acc', 'mov', 'mkv', 'm4s',
  'm3u8', 'm3u', 'mpeg', 'avi', 'wmv', 'asf', 'movie', 'divx',
  'mpeg4', 'vid', 'aac', 'mpd', 'weba', 'opus', 'srt', 'vtt',
].map((ext) => ({
  ext,
  size: 0,
  operator: '>=' as Operator,
  unit: 'KB' as const,
  state: !['ts', 'srt', 'vtt'].includes(ext),
}));

// ===== 默认 Type 规则(原 init.js 第 63-73 行) =====
export const DEFAULT_TYPE_RULES: TypeRule[] = [
  'audio/*', 'video/*',
  'application/ogg',
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
  'application/mpegurl',
  'application/octet-stream-m3u8',
  'application/dash+xml',
  'application/m4s',
].map((type) => ({
  type,
  size: 0,
  operator: '>=' as Operator,
  unit: 'KB' as const,
  state: true,
}));

// ===== 默认 Regex 规则(原 init.js 第 74-79 行) =====
export const DEFAULT_REGEX_RULES: RegexRule[] = [
  { type: 'ig', regex: 'https://cache\\.video\\.[a-z]*\\.com/dash\\?tvid=.*', ext: 'json', state: false },
  { type: 'ig', regex: '.*\\.bilivideo\\.(com|cn).*\\/live-bvc\\/.*m4s', ext: '', blackList: true, state: false },
  { type: 'ig', regex: '(^https://scontent[a-z0-9-]*\\.cdninstagram\\.com/.*)&bytestart=.*', ext: '', blackList: false, state: false },
  { type: 'ig', regex: '(^https://.*\\.fbcdn\\.net/.*)&bytestart=.*', ext: '', blackList: false, state: false },
];

// ===== 避免抓取列表(原 G.damnUrl) =====
export const DEFAULT_DAMN_URL_PATTERNS: RegExp[] = [
  /^https:\/\/.*\.douyin\.com\/.*$/i,
];

// ===== OptionLists 标量默认值(原 init.js 第 80-176 行) =====
export const DEFAULT_OPTIONS = {
  TitleName: false as boolean | string,
  Player: '',
  ShowWebIco: typeof navigator !== 'undefined' && !/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent),
  MobileUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',

  // m3u8dl 协议
  m3u8dl: 0 as 0 | 1 | 2,
  m3u8dlArg: '"${url}" --save-dir "%USERPROFILE%\\Downloads\\m3u8dl" --save-name "${title}_${now}" ${referer|exists:\'-H "Referer:*"\'} ${cookie|exists:\'-H "Cookie:*"\'} --no-log',
  m3u8dlConfirm: false,

  playbackRate: 2,

  copyM3U8: '${url}',
  copyMPD: '${url}',
  copyOther: '${url}',

  autoClearMode: 1 as 0 | 1 | 2,
  catDownload: false,
  saveAs: false,
  userAgent: '',
  downFileName: '${title}.${ext}',
  css: '',
  checkDuplicates: true,
  enable: true as boolean,
  downActive: typeof navigator !== 'undefined' && !/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent),
  downAutoClose: true,
  downStream: false,

  // Aria2
  aria2Rpc: 'http://localhost:6800/jsonrpc',
  enableAria2Rpc: false,
  enableAria2RpcReferer: true,
  aria2RpcToken: '',
  aria2RpcDir: '',

  m3u8AutoDown: true,
  badgeNumber: true,

  // 发送到本地
  send2local: false,
  send2localManual: false,
  send2localURL: 'http://127.0.0.1:8000/',
  send2localMethod: 'POST' as 'POST' | 'GET',
  send2localBody: '{"action": "${action}", "data": ${data}, "tabId": "${tabId}"}',
  send2localType: 0 as 0 | 1 | 2 | 3,
  send2localHeaders: '',

  popup: false,
  popupMode: 0 as 0 | 1 | 2 | 3,

  // 远程调用
  invoke: false,
  invokeText: 'm3u8dlre:"${url}" --save-dir "%USERPROFILE%\\Downloads" --del-after-done --save-name "${title}_${now}" --auto-select ${referer|exists:\'-H "Referer: *"\'}',
  invokeConfirm: false,

  // m3u8 解析器默认参数
  M3u8Thread: 6,
  M3u8Mp4: false,
  M3u8OnlyAudio: false,
  M3u8SkipDecrypt: false,
  M3u8StreamSaver: false,
  M3u8Ffmpeg: true,
  M3u8AutoClose: false,

  onlineServiceAddress: 0 as 0 | 1,
  chromeLimitSize: 1.8 * 1024 * 1024 * 1024,
  blockUrl: [] as BlockUrlRuleRaw[],
  blockUrlWhite: false,
  maxLength: typeof navigator !== 'undefined' && /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 999 : 9999,
  sidePanel: false,
  deepSearch: false,

  // MQTT
  send2MQTT: false,
  mqttEnable: false,
  mqttBroker: 'test.mosquitto.org',
  mqttPort: 8081,
  mqttPath: '/mqtt',
  mqttProtocol: 'wss' as 'wss' | 'ws',
  mqttClientId: 'cat-catch-client',
  mqttUser: '',
  mqttPassword: '',
  mqttTopic: 'cat-catch/media',
  mqttQos: 0,
  mqttTitleLength: 100,
  mqttDataFormat: '',

  getHtmlDOM: false,
  damn: false,
  iframeFFmpeg: false,
  contextMenus: false,
  reverse: false,
};

// ===== LocalVar 默认值(原 init.js 第 179-189 行) =====
export const DEFAULT_LOCAL_VAR = {
  featMobileTabId: [] as number[],
  featAutoDownTabId: [] as number[],
  mediaControl: { tabid: 0, index: -1 },
  previewShowTitle: false,
  previewDeleteDuplicateFilenames: false,
  M3u8HideDownloadedSegments: true,
};

// ===== 脚本列表(原 init.js 第 197-202 行) =====
export interface ScriptEntry {
  key: string;
  refresh: boolean;
  allFrames: boolean;
  world: 'MAIN' | 'ISOLATED';
  name: string;
  off: string;
  i18n: boolean;
  tabId: Set<number>;
}

export const DEFAULT_SCRIPT_LIST: Array<[string, Omit<ScriptEntry, 'tabId'>]> = [
  ['search.js', { key: 'search', refresh: true, allFrames: true, world: 'MAIN', name: 'deepSearch', off: 'closeSearch', i18n: false }],
  ['catch.js', { key: 'catch', refresh: true, allFrames: true, world: 'MAIN', name: 'cacheCapture', off: 'closeCapture', i18n: true }],
  ['recorder.js', { key: 'recorder', refresh: false, allFrames: true, world: 'MAIN', name: 'videoRecording', off: 'closeRecording', i18n: true }],
  ['recorder2.js', { key: 'recorder2', refresh: false, allFrames: false, world: 'MAIN', name: 'screenCapture', off: 'closeCapture', i18n: true }],
  ['webrtc.js', { key: 'webrtc', refresh: true, allFrames: true, world: 'MAIN', name: 'recordWebRTC', off: 'closeRecording', i18n: true }],
];

// ===== ffmpeg 配置(原 init.js 第 205-212 行) =====
export interface FfmpegConfig {
  tab: number;
  cacheData: unknown[];
  version: number;
  url: string;
}

export function createFfmpegConfig(onlineServiceAddress: 0 | 1 = 0): FfmpegConfig {
  return {
    tab: 0,
    cacheData: [],
    version: 1,
    url: onlineServiceAddress === 0 ? 'https://ffmpeg.bmmmd.com/' : 'https://ffmpeg.94cat.com/',
  };
}

// ===== streamSaver 配置 =====
export function getStreamSaverUrl(onlineServiceAddress: 0 | 1 = 0): string {
  return onlineServiceAddress === 0
    ? 'https://stream.bmmmd.com/mitm.html'
    : 'https://ffmpeg.94cat.com/mitm.html';
}
