import React, { createContext, useContext, useMemo, useState, useCallback } from 'react'
import type { YtDlpConfig, Platform, VideoMeta } from '@/lib/yt-dlp/types'
import { DEFAULT_CONFIG } from '@/lib/yt-dlp/defaults'

interface ConfigContextValue {
  config: YtDlpConfig
  platform: Platform
  videoMeta: VideoMeta | null
  resolving: boolean
  setPlatform: (p: Platform) => void
  updateField: <K extends keyof YtDlpConfig>(key: K, value: YtDlpConfig[K]) => void
  applyPatch: (patch: Partial<YtDlpConfig>) => void
  applyPreset: (patch: Partial<YtDlpConfig>) => void
  resetConfig: () => void
  loadConfig: (patch: Partial<YtDlpConfig>) => void
  setVideoMeta: (m: VideoMeta | null) => void
  setResolving: (v: boolean) => void
}

const ConfigContext = createContext<ConfigContextValue | null>(null)

export function ConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<YtDlpConfig>({ ...DEFAULT_CONFIG })
  const [platform, setPlatform] = useState<Platform>('bash')
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null)
  const [resolving, setResolving] = useState(false)

  const updateField = useCallback(
    <K extends keyof YtDlpConfig>(key: K, value: YtDlpConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  const applyPatch = useCallback((patch: Partial<YtDlpConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  // 应用预设：覆盖式合并（保留 urls）
  const applyPreset = useCallback((patch: Partial<YtDlpConfig>) => {
    setConfig((prev) => ({
      ...DEFAULT_CONFIG,
      ...patch,
      urls: prev.urls,
    }))
  }, [])

  const resetConfig = useCallback(() => {
    setConfig((prev) => ({ ...DEFAULT_CONFIG, urls: prev.urls }))
  }, [])

  const loadConfig = useCallback((patch: Partial<YtDlpConfig>) => {
    setConfig((prev) => ({ ...DEFAULT_CONFIG, ...patch, urls: prev.urls }))
  }, [])

  const value = useMemo<ConfigContextValue>(
    () => ({
      config,
      platform,
      videoMeta,
      resolving,
      setPlatform,
      updateField,
      applyPatch,
      applyPreset,
      resetConfig,
      loadConfig,
      setVideoMeta,
      setResolving,
    }),
    [config, platform, videoMeta, resolving, updateField, applyPatch, applyPreset, resetConfig, loadConfig],
  )

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
}

export function useConfig() {
  const ctx = useContext(ConfigContext)
  if (!ctx) throw new Error('useConfig 必须在 ConfigProvider 内使用')
  return ctx
}