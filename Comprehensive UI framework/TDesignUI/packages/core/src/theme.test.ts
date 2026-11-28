import { describe, expect, it, vi } from 'vitest';
import {
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  THEMES,
  applyTheme,
  createThemeStore,
  isThemeName,
  nextTheme,
  persistTheme,
  readStoredTheme,
  resolveInitialTheme,
  resolveSystemTheme,
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

/** 极简假存储，模拟 localStorage 的同步接口 */
function makeFakeStorage(seed: Record<string, string> = {}) {
  const data: Record<string, string> = { ...seed };
  return {
    data,
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
}

describe('主题持久化', () => {
  it('存过深色就读回深色', () => {
    expect(readStoredTheme(makeFakeStorage({ [THEME_STORAGE_KEY]: 'dark' }))).toBe('dark');
  });

  it('没存过返回 null', () => {
    expect(readStoredTheme(makeFakeStorage())).toBeNull();
  });

  it('存了非法值当作没存过', () => {
    expect(readStoredTheme(makeFakeStorage({ [THEME_STORAGE_KEY]: 'blue' }))).toBeNull();
  });

  it('没有存储环境时不报错', () => {
    expect(readStoredTheme(null)).toBeNull();
    expect(() => persistTheme('dark', null)).not.toThrow();
  });

  it('persistTheme 写入固定 key', () => {
    const storage = makeFakeStorage();
    persistTheme('dark', storage);
    expect(storage.data[THEME_STORAGE_KEY]).toBe('dark');
  });

  it('存储抛错（隐私模式）不影响主流程', () => {
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(readStoredTheme(throwing)).toBeNull();
    expect(() => persistTheme('dark', throwing)).not.toThrow();
  });

  it('切换后自动写回存储', () => {
    const storage = makeFakeStorage();
    const store = createThemeStore('light', storage);
    store.toggle();
    expect(storage.data[THEME_STORAGE_KEY]).toBe('dark');
    store.set('light');
    expect(storage.data[THEME_STORAGE_KEY]).toBe('light');
  });

  it('set 到相同值不写存储', () => {
    const storage = makeFakeStorage();
    const store = createThemeStore('light', storage);
    store.set('light');
    expect(storage.data[THEME_STORAGE_KEY]).toBeUndefined();
  });
});

describe('初始主题解析', () => {
  it('有存储优先用存储', () => {
    const storage = makeFakeStorage({ [THEME_STORAGE_KEY]: 'dark' });
    expect(resolveInitialTheme(storage)).toBe('dark');
  });

  it('没存储且无 matchMedia 时回退浅色', () => {
    expect(resolveInitialTheme(makeFakeStorage())).toBe('light');
  });

  it('没存储时跟随系统深色偏好', () => {
    const original = (globalThis as { matchMedia?: unknown }).matchMedia;
    (globalThis as { matchMedia?: unknown }).matchMedia = (query: string) => ({
      matches: query.includes('dark'),
    });
    try {
      expect(resolveSystemTheme()).toBe('dark');
      expect(resolveInitialTheme(null)).toBe('dark');
    } finally {
      (globalThis as { matchMedia?: unknown }).matchMedia = original;
    }
  });

  it('matchMedia 抛错时回退浅色', () => {
    const original = (globalThis as { matchMedia?: unknown }).matchMedia;
    (globalThis as { matchMedia?: unknown }).matchMedia = () => {
      throw new Error('unsupported');
    };
    try {
      expect(resolveSystemTheme()).toBe('light');
    } finally {
      (globalThis as { matchMedia?: unknown }).matchMedia = original;
    }
  });
});
