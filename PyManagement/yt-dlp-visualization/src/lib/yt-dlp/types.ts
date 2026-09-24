// yt-dlp 配置类型定义

export type OptionCategory =
  | 'general'
  | 'network'
  | 'geo'
  | 'selection'
  | 'audio'
  | 'filesystem'
  | 'subtitle'
  | 'postprocess'
  | 'auth'
  | 'verbosity'
  | 'workarounds'

export type Platform = 'bash' | 'powershell' | 'cmd'

export interface YtDlpConfig {
  // 目标与输出
  urls: string
  outputDir: string
  outputTemplate: string
  restrictFilenames: boolean
  noOverwrites: boolean
  forceOverwrites: boolean
  continue: boolean
  noPart: boolean
  writeThumbnail: boolean
  writeInfoJson: boolean

  // 格式选择
  formatMode: 'quick' | 'custom'
  quickFormat: string
  customFormat: string
  formatSort: string
  preferFree: boolean
  container: string

  // 音频
  extractAudio: boolean
  audioFormat: string
  audioQuality: string

  // 网络
  proxy: string
  socketTimeout: string
  rateLimit: string
  minFilesize: string
  maxFilesize: string
  retries: string
  fragmentRetries: string
  concurrentFragments: string
  bufferSize: string

  // 地理
  geoBypass: boolean
  geoBypassCountry: string
  forceIpv4: boolean
  forceIpv6: boolean

  // 字幕与元数据
  writeSubs: boolean
  writeAutoSubs: boolean
  subLangs: string
  subFormat: string
  embedSubs: boolean
  embedMetadata: boolean
  embedThumbnail: boolean
  addMetadata: boolean

  // 后处理
  recodeVideo: string
  remuxVideo: string
  splitChapters: boolean
  removeChapters: string
  externalDownloader: string
  externalDownloaderArgs: string
  ffmpegLocation: string
  postprocessorArgs: string

  // 认证
  cookiesFromBrowser: string
  cookiesFile: string
  username: string
  password: string
  videoPassword: string

  // 播放列表
  playlistItems: string
  playlistStart: string
  playlistEnd: string
  playlistReverse: boolean
  playlistRandom: boolean
  noPlaylist: boolean

  // 冗余/调试
  simulate: boolean
  quiet: boolean
  verbose: boolean
  ignoreErrors: boolean
  noWarnings: boolean
  skipDownload: boolean
  print: string
  dumpJson: boolean
  listFormats: boolean
  listSubs: boolean
  noCheckCertificate: boolean
  encoding: string

  // 下载限制
  downloadArchive: string
  ageLimit: string
  matchFilter: string
  matchTitle: string
  rejectTitle: string
  date: string
  datebefore: string
  dateafter: string
  minViews: string
  maxViews: string

  // 后处理（扩展）
  parseMetadata: string
  metadataFromTitle: string
  xattrs: boolean
  exec: string
  execBeforeDownload: string

  // 网络（扩展）
  sourceAddress: string
  sleepInterval: string
  maxSleepInterval: string

  // 文件系统
  cacheDir: string
  noCacheDir: boolean
  trimFileName: string

  // 认证（扩展）
  apMso: string
  apUsername: string
  apPassword: string
}

export interface OptionDef {
  id: keyof YtDlpConfig
  flag: string
  shortFlag?: string
  label: string
  desc: string
  category: OptionCategory
  type: 'text' | 'number' | 'select' | 'switch'
  options?: { value: string; label: string }[]
  placeholder?: string
  argName?: string
}

export interface QuickFormat {
  id: string
  label: string
  desc: string
  // 应用到配置的补丁
  apply: Partial<YtDlpConfig>
}

export interface VideoMeta {
  title: string
  author: string
  thumbnail: string
  source: string
  duration?: number
}

export interface Preset {
  id: string
  name: string
  description: string
  category: string
  config: Partial<YtDlpConfig>
  created_at: string
  updated_at: string
}

export interface BatchTask {
  id: string
  url: string
  title: string
  preset_name: string
  config: Partial<YtDlpConfig>
  status: string
  created_at: string
}

export const CATEGORY_LABELS: Record<OptionCategory, string> = {
  general: '通用选项',
  network: '网络选项',
  geo: '地理限制',
  selection: '格式选择',
  audio: '音频提取',
  filesystem: '文件系统',
  subtitle: '字幕与元数据',
  postprocess: '后处理',
  auth: '身份认证',
  verbosity: '冗余与调试',
  workarounds: '兼容与修复',
}