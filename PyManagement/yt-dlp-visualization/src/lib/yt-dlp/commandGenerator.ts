import type { YtDlpConfig, Platform } from './types'
import { QUICK_FORMATS } from './quickFormats'

// 判断字符串是否需要引号包裹（含空格或特殊字符）
function needsQuote(s: string): boolean {
  return /[\s"'$`&|<>^()%!#]/.test(s)
}

// 按平台对单个参数值进行转义与引号包裹
function escapeArg(value: string, platform: Platform): string {
  const v = String(value)
  if (!needsQuote(v)) return v
  switch (platform) {
    case 'cmd':
      // Windows CMD：双引号包裹，内部双引号转义为 ""
      return `"${v.replace(/"/g, '""')}"`
    case 'powershell':
      // PowerShell：单引号包裹，内部单引号转义为 ''
      return `'${v.replace(/'/g, "''")}'`
    case 'bash':
    default:
      // Bash/Zsh：单引号包裹，内部单引号用 '\'' 处理
      return `'${v.replace(/'/g, "'\\''")}'`
  }
}

// 根据 quickFormat 生成 -f 表达式
function quickFormatExpr(quickId: string): string {
  switch (quickId) {
    case 'best':
      return 'bestvideo*+bestaudio/best'
    case 'bestvideo':
      return 'bestvideo'
    case '4k':
      return 'bestvideo[height<=?2160]+bestaudio/best'
    case '1440p':
      return 'bestvideo[height<=?1440]+bestaudio/best'
    case '1080p':
      return 'bestvideo[height<=?1080]+bestaudio/best'
    case '720p':
      return 'bestvideo[height<=?720]+bestaudio/best'
    case '480p':
      return 'bestvideo[height<=?480]+bestaudio/best'
    case 'audio-best':
    case 'audio-mp3':
    case 'audio-m4a':
    case 'audio-flac':
    case 'audio-wav':
      return 'bestaudio/best'
    default:
      return 'bestvideo*+bestaudio/best'
  }
}

export interface GeneratedCommand {
  binary: string
  args: string[]
  full: string
}

// 根据配置生成 yt-dlp 命令参数列表（按规范顺序）
export function buildArgs(config: YtDlpConfig): string[] {
  const args: string[] = []

  // —— 通用与输出 ——
  if (config.outputDir) args.push('--paths', config.outputDir)
  if (config.outputTemplate) args.push('--output', config.outputTemplate)
  if (config.restrictFilenames) args.push('--restrict-filenames')
  if (config.noOverwrites) args.push('--no-overwrites')
  if (config.forceOverwrites) args.push('--force-overwrites')
  if (config.continue) args.push('--continue')
  if (config.noPart) args.push('--no-part')
  if (config.writeThumbnail) args.push('--write-thumbnail')
  if (config.writeInfoJson) args.push('--write-info-json')
  if (config.ignoreErrors) args.push('--ignore-errors')

  // —— 播放列表 ——
  if (config.noPlaylist) args.push('--no-playlist')
  if (config.playlistItems) args.push('--playlist-items', config.playlistItems)
  if (config.playlistStart) args.push('--playlist-start', config.playlistStart)
  if (config.playlistEnd) args.push('--playlist-end', config.playlistEnd)
  if (config.playlistReverse) args.push('--playlist-reverse')
  if (config.playlistRandom) args.push('--playlist-random')

  // —— 网络选项 ——
  if (config.proxy) args.push('--proxy', config.proxy)
  if (config.socketTimeout) args.push('--socket-timeout', config.socketTimeout)
  if (config.rateLimit) args.push('--limit-rate', config.rateLimit)
  if (config.bufferSize) args.push('--buffer-size', config.bufferSize)
  if (config.minFilesize) args.push('--min-filesize', config.minFilesize)
  if (config.maxFilesize) args.push('--max-filesize', config.maxFilesize)
  if (config.retries) args.push('--retries', config.retries)
  if (config.fragmentRetries) args.push('--fragment-retries', config.fragmentRetries)
  if (config.concurrentFragments && config.concurrentFragments !== '1')
    args.push('--concurrent-fragments', config.concurrentFragments)
  if (config.sourceAddress) args.push('--source-address', config.sourceAddress)
  if (config.sleepInterval) args.push('--sleep-interval', config.sleepInterval)
  if (config.maxSleepInterval) args.push('--max-sleep-interval', config.maxSleepInterval)

  // —— 地理限制 ——
  if (config.geoBypassCountry) {
    args.push('--geo-bypass-country', config.geoBypassCountry)
  } else if (config.geoBypass) {
    args.push('--geo-bypass')
  }
  if (config.forceIpv4) args.push('--force-ipv4')
  if (config.forceIpv6) args.push('--force-ipv6')

  // —— 格式选择 ——
  if (config.formatMode === 'custom' && config.customFormat) {
    args.push('--format', config.customFormat)
  } else {
    args.push('--format', quickFormatExpr(config.quickFormat))
  }
  if (config.formatSort) args.push('--format-sort', config.formatSort)
  if (config.preferFree) args.push('--prefer-free-formats')
  if (config.container && config.container !== 'auto')
    args.push('--merge-output-format', config.container)

  // —— 音频提取 ——
  if (config.extractAudio) {
    args.push('--extract-audio')
    if (config.audioFormat && config.audioFormat !== 'best')
      args.push('--audio-format', config.audioFormat)
    if (config.audioQuality) args.push('--audio-quality', config.audioQuality)
  }

  // —— 字幕与元数据 ——
  if (config.writeSubs) args.push('--write-subs')
  if (config.writeAutoSubs) args.push('--write-auto-subs')
  if (config.subLangs) args.push('--sub-langs', config.subLangs)
  if (config.subFormat && config.subFormat !== 'best')
    args.push('--sub-format', config.subFormat)
  if (config.embedSubs) args.push('--embed-subs')
  if (config.embedMetadata) args.push('--embed-metadata')
  if (config.embedThumbnail) args.push('--embed-thumbnail')
  if (config.addMetadata) args.push('--add-metadata')

  // —— 后处理 ——
  if (config.recodeVideo) args.push('--recode-video', config.recodeVideo)
  if (config.remuxVideo) args.push('--remux-video', config.remuxVideo)
  if (config.splitChapters) args.push('--split-chapters')
  if (config.removeChapters) args.push('--remove-chapters', config.removeChapters)
  if (config.externalDownloader && config.externalDownloader !== 'none')
    args.push('--external-downloader', config.externalDownloader)
  if (config.externalDownloaderArgs)
    args.push('--external-downloader-args', config.externalDownloaderArgs)
  if (config.ffmpegLocation) args.push('--ffmpeg-location', config.ffmpegLocation)
  if (config.postprocessorArgs)
    args.push('--postprocessor-args', config.postprocessorArgs)
  if (config.parseMetadata) args.push('--parse-metadata', config.parseMetadata)
  if (config.metadataFromTitle)
    args.push('--metadata-from-title', config.metadataFromTitle)
  if (config.xattrs) args.push('--xattrs')
  if (config.exec) args.push('--exec', config.exec)
  if (config.execBeforeDownload)
    args.push('--exec-before-download', config.execBeforeDownload)

  // —— 身份认证 ——
  if (config.cookiesFromBrowser && config.cookiesFromBrowser !== 'none')
    args.push('--cookies-from-browser', config.cookiesFromBrowser)
  if (config.cookiesFile) args.push('--cookies', config.cookiesFile)
  if (config.username) args.push('--username', config.username)
  if (config.password) args.push('--password', config.password)
  if (config.videoPassword) args.push('--video-password', config.videoPassword)
  if (config.apMso) args.push('--ap-mso', config.apMso)
  if (config.apUsername) args.push('--ap-username', config.apUsername)
  if (config.apPassword) args.push('--ap-password', config.apPassword)

  // —— 兼容与修复 ——
  if (config.downloadArchive) args.push('--download-archive', config.downloadArchive)
  if (config.ageLimit) args.push('--age-limit', config.ageLimit)
  if (config.matchFilter) args.push('--match-filter', config.matchFilter)
  if (config.matchTitle) args.push('--match-title', config.matchTitle)
  if (config.rejectTitle) args.push('--reject-title', config.rejectTitle)
  if (config.date) args.push('--date', config.date)
  if (config.datebefore) args.push('--datebefore', config.datebefore)
  if (config.dateafter) args.push('--dateafter', config.dateafter)
  if (config.minViews) args.push('--match-filter', `view_count >=? ${config.minViews}`)
  if (config.maxViews) args.push('--match-filter', `view_count <=? ${config.maxViews}`)

  // —— 文件系统 ——
  if (config.cacheDir) args.push('--cache-dir', config.cacheDir)
  if (config.noCacheDir) args.push('--no-cache-dir')
  if (config.trimFileName) args.push('--trim-file-name', config.trimFileName)

  // —— 冗余与调试 ——
  if (config.simulate) args.push('--simulate')
  if (config.skipDownload) args.push('--skip-download')
  if (config.quiet) args.push('--quiet')
  if (config.noWarnings) args.push('--no-warnings')
  if (config.verbose) args.push('--verbose')
  if (config.print) args.push('--print', config.print)
  if (config.dumpJson) args.push('--dump-json')
  if (config.listFormats) args.push('--list-formats')
  if (config.listSubs) args.push('--list-subs')
  if (config.noCheckCertificate) args.push('--no-check-certificate')
  if (config.encoding) args.push('--encoding', config.encoding)

  return args
}

// 生成完整命令字符串（含 URL 与平台转义）
export function generateCommand(config: YtDlpConfig, platform: Platform): GeneratedCommand {
  const args = buildArgs(config)
  const urls = config.urls
    .split('\n')
    .map((u) => u.trim())
    .filter(Boolean)

  const parts: string[] = ['yt-dlp', ...args.map((a) => escapeArg(a, platform))]
  for (const u of urls) {
    parts.push(escapeArg(u, platform))
  }

  return {
    binary: 'yt-dlp',
    args,
    full: parts.join(' '),
  }
}

// 生成批处理脚本
export function generateBatchScript(
  configs: { config: YtDlpConfig; platform: Platform }[],
  platform: Platform,
): string {
  const lines: string[] = []
  if (platform === 'cmd') {
    lines.push('@echo off', 'chcp 65001 >nul', '')
  } else {
    lines.push('#!/usr/bin/env bash', 'set -e', '')
  }
  for (const { config } of configs) {
    const cmd = generateCommand(config, platform)
    lines.push(cmd.full)
  }
  if (platform !== 'cmd') {
    lines.push('', 'echo "全部下载任务已完成"')
  } else {
    lines.push('', 'echo 全部下载任务已完成')
  }
  return lines.join('\n')
}

// 生成 yt-dlp --batch-file 格式文本（每行一个 URL）
export function generateBatchFile(config: YtDlpConfig): string {
  return config.urls
    .split('\n')
    .map((u) => u.trim())
    .filter(Boolean)
    .join('\n')
}

export { QUICK_FORMATS }