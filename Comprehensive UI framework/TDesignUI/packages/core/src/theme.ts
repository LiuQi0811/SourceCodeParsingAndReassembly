// 主题模型：纯数据 + 一个挂载点，两端共用同一套切换逻辑
import type { Unsubscribe } from './counter';

export type ThemeName = 'light' | 'dark';
export const THEMES: readonly ThemeName[] = ['light', 'dark'];

/** 与 TDesign 组件库约定一致的属性名：写在 html 上，组件库和我们的 token 同时生效 */
export const THEME_ATTRIBUTE = 'theme-mode';

export function isThemeName(value: string): value is ThemeName {
  return THEMES.includes(value as ThemeName);
}

export function themeLabel(theme: ThemeName): string {
  return theme === 'dark' ? '深色' : '浅色';
}

export function nextTheme(theme: ThemeName): ThemeName {
  return theme === 'dark' ? 'light' : 'dark';
}

export interface ThemeStore {
  get: () => ThemeName;
  subscribe: (listener: (theme: ThemeName) => void) => Unsubscribe;
  set: (theme: ThemeName) => void;
  toggle: () => void;
}

export function createThemeStore(initial: ThemeName = 'light'): ThemeStore {
  let current = initial;
  const listeners = new Set<(theme: ThemeName) => void>();

  const emit = () => listeners.forEach((listener) => listener(current));

  return {
    get: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (theme) => {
      if (!isThemeName(theme) || theme === current) return;
      current = theme;
      emit();
    },
    toggle: () => {
      current = nextTheme(current);
      emit();
    },
  };
}

/** 最小结构类型，避免让 core 依赖 DOM lib */
export interface ThemeTarget {
  setAttribute: (name: string, value: string) => void;
}

export function resolveThemeTarget(): ThemeTarget | null {
  const doc = (globalThis as { document?: { documentElement?: ThemeTarget } }).document;
  return doc?.documentElement ?? null;
}

/** 两端唯一需要碰 DOM 的一行：把主题写到 html 的 theme-mode 上 */
export function applyTheme(
  theme: ThemeName,
  target: ThemeTarget | null = resolveThemeTarget(),
): void {
  target?.setAttribute(THEME_ATTRIBUTE, theme);
}

/** 应用级共享单例：导航栏切一次，所有已订阅的界面同步更新 */
export const themeStore = createThemeStore();
