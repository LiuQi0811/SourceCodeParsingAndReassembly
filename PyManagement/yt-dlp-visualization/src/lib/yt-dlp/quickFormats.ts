import type { QuickFormat } from './types'

// 快速格式预设：一键选择常见下载画质/格式
export const QUICK_FORMATS: QuickFormat[] = [
  {
    id: 'best',
    label: '最佳画质',
    desc: '下载可用的最佳视频+音频组合',
    apply: { formatMode: 'quick', quickFormat: 'best', extractAudio: false },
  },
  {
    id: 'bestvideo',
    label: '最佳视频（无合并）',
    desc: '单独最佳视频流，可能无音频',
    apply: { formatMode: 'quick', quickFormat: 'bestvideo', extractAudio: false },
  },
  {
    id: '4k',
    label: '4K 超清',
    desc: '优先 2160p 及更高分辨率',
    apply: {
      formatMode: 'quick',
      quickFormat: '4k',
      extractAudio: false,
      formatSort: 'res:2160',
    },
  },
  {
    id: '1440p',
    label: '2K 1440p',
    desc: '优先 1440p 分辨率',
    apply: {
      formatMode: 'quick',
      quickFormat: '1440p',
      extractAudio: false,
      formatSort: 'res:1440',
    },
  },
  {
    id: '1080p',
    label: '1080P 全高清',
    desc: '优先 1080p 分辨率',
    apply: {
      formatMode: 'quick',
      quickFormat: '1080p',
      extractAudio: false,
      formatSort: 'res:1080',
    },
  },
  {
    id: '720p',
    label: '720P 高清',
    desc: '优先 720p 分辨率，体积更小',
    apply: {
      formatMode: 'quick',
      quickFormat: '720p',
      extractAudio: false,
      formatSort: 'res:720',
    },
  },
  {
    id: '480p',
    label: '480P 标清',
    desc: '优先 480p，适合移动设备',
    apply: {
      formatMode: 'quick',
      quickFormat: '480p',
      extractAudio: false,
      formatSort: 'res:480',
    },
  },
  {
    id: 'audio-best',
    label: '仅音频（最佳）',
    desc: '提取最佳音质，保留原始格式',
    apply: {
      formatMode: 'quick',
      quickFormat: 'audio-best',
      extractAudio: true,
      audioFormat: 'best',
    },
  },
  {
    id: 'audio-mp3',
    label: 'MP3 音频',
    desc: '提取音频并转换为 MP3',
    apply: {
      formatMode: 'quick',
      quickFormat: 'audio-mp3',
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: '0',
    },
  },
  {
    id: 'audio-m4a',
    label: 'M4A 音频',
    desc: '提取音频并转换为 M4A (AAC)',
    apply: {
      formatMode: 'quick',
      quickFormat: 'audio-m4a',
      extractAudio: true,
      audioFormat: 'm4a',
      audioQuality: '0',
    },
  },
  {
    id: 'audio-flac',
    label: 'FLAC 无损',
    desc: '提取音频并转换为无损 FLAC',
    apply: {
      formatMode: 'quick',
      quickFormat: 'audio-flac',
      extractAudio: true,
      audioFormat: 'flac',
    },
  },
  {
    id: 'audio-wav',
    label: 'WAV 音频',
    desc: '提取音频并转换为 WAV',
    apply: {
      formatMode: 'quick',
      quickFormat: 'audio-wav',
      extractAudio: true,
      audioFormat: 'wav',
    },
  },
]