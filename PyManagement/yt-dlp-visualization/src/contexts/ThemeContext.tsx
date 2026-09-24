import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type ThemeName = 'green' | 'amber' | 'cyan'

export interface ThemeOption {
  name: ThemeName
  label: string
  swatch: string
  desc: string
}

export const THEME_OPTIONS: ThemeOption[] = [
  { name: 'green', label: '矩阵绿', swatch: 'hsl(128 100% 46%)', desc: '经典 CRT 荧光绿' },
  { name: 'amber', label: '琥珀屏', swatch: 'hsl(41 100% 50%)', desc: '老式终端琥珀色' },
  { name: 'cyan', label: '赛博青', swatch: 'hsl(190 100% 50%)', desc: '科幻全息青蓝' },
]

interface ThemeContextValue {
  theme: ThemeName
  setTheme: (t: ThemeName) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'ytdlp-theme'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeName | null
      if (saved === 'green' || saved === 'amber' || saved === 'cyan') return saved
    } catch (_e) {
      /* ignore */
    }
    return 'green'
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-green', 'theme-amber', 'theme-cyan')
    root.classList.add(`theme-${theme}`)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch (_e) {
      /* ignore */
    }
  }, [theme])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme: setThemeState }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return ctx
}