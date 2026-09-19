import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

export type ThemeId =
  | 'antd'
  | 'tdesign'
  | 'clean'
  | 'warm'
  | 'space'
  | 'midnight'
  | 'violet'
  | 'terminal';

export const THEME_IDS: ThemeId[] = [
  'antd',
  'tdesign',
  'clean',
  'warm',
  'space',
  'midnight',
  'violet',
  'terminal',
];

interface ThemeState {
  theme: ThemeId;
  customImage: string | null;
  setTheme: (t: ThemeId) => void;
  setCustomImage: (url: string | null) => void;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

const STORAGE_KEY = 'crawler-theme';

function loadInitial(): { theme: ThemeId; customImage: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        theme: THEME_IDS.includes(parsed.theme) ? parsed.theme : 'antd',
        customImage: typeof parsed.customImage === 'string' ? parsed.customImage : null,
      };
    }
  } catch {
    // 忽略损坏的本地配置
  }
  return { theme: 'antd', customImage: null };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(loadInitial);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', state.theme);
    if (state.customImage) {
      root.classList.add('custom-bg');
      root.style.setProperty('--bg-image', `url("${state.customImage}")`);
    } else {
      root.classList.remove('custom-bg');
      root.style.removeProperty('--bg-image');
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 忽略存储异常
    }
  }, [state]);

  const setTheme = useCallback((theme: ThemeId) => setState((prev) => ({ ...prev, theme })), []);
  const setCustomImage = useCallback(
    (customImage: string | null) => setState((prev) => ({ ...prev, customImage })),
    [],
  );

  return (
    <ThemeContext.Provider value={{ ...state, setTheme, setCustomImage }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用');
  return ctx;
}