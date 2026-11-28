import { describe, expect, it, vi } from 'vitest';
import {
  THEME_ATTRIBUTE,
  THEMES,
  applyTheme,
  createThemeStore,
  isThemeName,
  nextTheme,
  resolveThemeTarget,
  themeLabel,
} from './';

describe('主题常量', () => {
  it('只有浅色和深色两种', () => {
    expect(THEMES).toEqual(['light', 'dark']);
  });

  it('属性名与 TDesign 约定一致', () => {
    expect(THEME_ATTRIBUTE).toBe('theme-mode');
  });

  it('isThemeName 只认合法值', () => {
    expect(isThemeName('dark')).toBe(true);
    expect(isThemeName('light')).toBe(true);
    expect(isThemeName('blue')).toBe(false);
    expect(isThemeName('')).toBe(false);
  });

  it('文案', () => {
    expect(themeLabel('light')).toBe('浅色');
    expect(themeLabel('dark')).toBe('深色');
  });

  it('切换目标', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('light');
  });
});

describe('createThemeStore', () => {
  it('默认是浅色', () => {
    expect(createThemeStore().get()).toBe('light');
  });

  it('可以指定初始主题', () => {
    expect(createThemeStore('dark').get()).toBe('dark');
  });

  it('toggle 来回切换', () => {
    const store = createThemeStore();
    store.toggle();
    expect(store.get()).toBe('dark');
    store.toggle();
    expect(store.get()).toBe('light');
  });

  it('set 到相同值不通知', () => {
    const store = createThemeStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set('light');
    expect(listener).not.toHaveBeenCalled();
    store.set('dark');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('set 非法值被忽略', () => {
    const store = createThemeStore();
    store.set('blue' as never);
    expect(store.get()).toBe('light');
  });

  it('订阅能收到切换后的主题', () => {
    const store = createThemeStore();
    const seen: string[] = [];
    store.subscribe((theme) => seen.push(theme));
    store.toggle();
    store.toggle();
    expect(seen).toEqual(['dark', 'light']);
  });

  it('退订后不再通知', () => {
    const store = createThemeStore();
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    store.toggle();
    stop();
    store.toggle();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('applyTheme', () => {
  it('把主题写到目标元素的 theme-mode 上', () => {
    const attrs: Record<string, string> = {};
    const target = {
      setAttribute: (name: string, value: string) => {
        attrs[name] = value;
      },
    };
    applyTheme('dark', target);
    expect(attrs[THEME_ATTRIBUTE]).toBe('dark');
  });

  it('Node 环境没有 document 时不报错', () => {
    expect(resolveThemeTarget()).toBeNull();
    expect(() => applyTheme('dark')).not.toThrow();
  });
});
